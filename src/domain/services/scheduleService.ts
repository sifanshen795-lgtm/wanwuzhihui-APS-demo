import dayjs from 'dayjs';
import type { BatchWorkOrderStatus, ScheduleItemStatus } from '../enums';
import type { MesStateData, ProductionOrder, ScheduleItem } from '../models/mes';
import { addWorkingMinutes, hasLineCalendar, nextWorkingTime } from './calendarService';
import { createAutoSchedulePlans } from './autoScheduleService';

const durationToHours = (duration: number, unit: '分钟' | '小时') => (unit === '分钟' ? duration / 60 : duration);
const durationToMinutes = (duration: number, unit: '分钟' | '小时') => (unit === '小时' ? duration * 60 : duration);
const priorityRank: Record<string, number> = { 高: 3, 中: 2, 低: 1 };
const recallableBatchStatuses: BatchWorkOrderStatus[] = ['待配方', '待审核', '待执行'];

export type ProductionOrderSchedulePlanPayload = {
  lineCode: string;
  singlePotOutput: number;
  singlePotWorkHours: number;
  cleanMinutes: number;
  plannedStartAt?: string;
  plannedEndAt?: string;
};

const resolveDefaultLineRelation = (data: MesStateData, productCode: string) => data.lineProductRelations
  .filter((relation) => relation.enabled && relation.productCode === productCode && data.lines.some((line) => line.code === relation.lineCode && line.enabled))
  .sort((a, b) => (priorityRank[b.productionPriority] ?? 0) - (priorityRank[a.productionPriority] ?? 0) || a.lineCode.localeCompare(b.lineCode))[0];

const relationToPlanSnapshot = (relation: { singlePotOutput: number; intervalDuration: number; intervalUnit: '分钟' | '小时'; cleanDuration: number; cleanUnit: '分钟' | '小时' }) => ({
  singlePotOutput: relation.singlePotOutput,
  singlePotWorkHours: Number(durationToHours(relation.intervalDuration, relation.intervalUnit).toFixed(2)),
  cleanMinutes: durationToMinutes(relation.cleanDuration, relation.cleanUnit),
});

const calculatePlan = (quantity: number, singlePotOutput: number, singlePotWorkHours: number, cleanMinutes: number) => {
  const safeSinglePotOutput = Math.max(1, Number(singlePotOutput) || 1);
  const batchCount = Math.max(1, Math.ceil(quantity / safeSinglePotOutput));
  const workHours = Number((batchCount * Math.max(0, Number(singlePotWorkHours) || 0) + Math.max(0, Number(cleanMinutes) || 0) / 60).toFixed(2));
  return { batchCount, workHours };
};

const buildScheduleWindow = (
  data: MesStateData,
  lineCode: string,
  cursor: dayjs.Dayjs,
  workHours: number,
  cleanMinutes: number,
) => {
  const useCalendar = hasLineCalendar(data, lineCode);
  const workOnlyHours = Math.max(0, workHours - cleanMinutes / 60);
  let startAt = cursor;
  let workEndAt = startAt.add(workOnlyHours, 'hour');
  let endAt = workEndAt.add(cleanMinutes, 'minute');
  if (useCalendar) {
    try {
      startAt = nextWorkingTime(data, lineCode, cursor);
      workEndAt = addWorkingMinutes(data, lineCode, startAt, Math.round(workOnlyHours * 60));
      endAt = addWorkingMinutes(data, lineCode, workEndAt, cleanMinutes);
    } catch {
      startAt = cursor;
      workEndAt = startAt.add(workOnlyHours, 'hour');
      endAt = workEndAt.add(cleanMinutes, 'minute');
    }
  }
  return { startAt, endAt };
};

const hasSchedulePlan = (order: ProductionOrder) =>
  Boolean(order.lineCode && order.plannedStartAt && order.plannedEndAt && order.batchCount && order.workHours !== undefined);

const buildInitialCursorByLine = (data: MesStateData, startBase: dayjs.Dayjs) => {
  const cursorByLine = new Map<string, dayjs.Dayjs>();
  data.scheduleItems.forEach((item) => {
    const endAt = dayjs(item.endAt);
    const current = cursorByLine.get(item.lineCode) ?? startBase;
    if (endAt.isAfter(current)) cursorByLine.set(item.lineCode, endAt);
  });
  data.productionOrders.filter(hasSchedulePlan).forEach((order) => {
    if (!order.lineCode || !order.plannedEndAt) return;
    const endAt = dayjs(order.plannedEndAt);
    const current = cursorByLine.get(order.lineCode) ?? startBase;
    if (endAt.isAfter(current)) cursorByLine.set(order.lineCode, endAt);
  });
  return cursorByLine;
};

const validateLineRelation = (data: MesStateData, productCode: string, lineCode: string) => {
  const relation = data.lineProductRelations.find((item) => item.enabled && item.productCode === productCode && item.lineCode === lineCode && data.lines.some((line) => line.code === item.lineCode && line.enabled));
  if (!relation) throw new Error('该产线与产品不匹配');
  return relation;
};

const validateNoLineOverlap = (
  data: MesStateData,
  productionOrderId: string,
  lineCode: string,
  startAt: dayjs.Dayjs,
  endAt: dayjs.Dayjs,
) => {
  const overlaps = (leftStart: dayjs.Dayjs, leftEnd: dayjs.Dayjs) => startAt.isBefore(leftEnd) && endAt.isAfter(leftStart);
  const scheduleItem = data.scheduleItems.find((item) => item.productionOrderId !== productionOrderId
    && item.lineCode === lineCode
    && overlaps(dayjs(item.startAt), dayjs(item.endAt)));
  if (scheduleItem) {
    throw new Error(`该时间与排程单 ${scheduleItem.id} 重叠，请调整时间或产线`);
  }
  const plannedOrder = data.productionOrders.find((item) => item.id !== productionOrderId
    && item.lineCode === lineCode
    && item.plannedStartAt
    && item.plannedEndAt
    && overlaps(dayjs(item.plannedStartAt), dayjs(item.plannedEndAt)));
  if (plannedOrder) {
    throw new Error(`该时间与生产订单 ${plannedOrder.id} 的排程重叠，请调整时间或产线`);
  }
};

const applyPlanPayload = (
  data: MesStateData,
  order: ProductionOrder,
  payload: ProductionOrderSchedulePlanPayload,
): ProductionOrder => {
  validateLineRelation(data, order.productCode, payload.lineCode);
  const plan = calculatePlan(order.quantity, payload.singlePotOutput, payload.singlePotWorkHours, payload.cleanMinutes);
  const startAt = payload.plannedStartAt ? dayjs(payload.plannedStartAt) : dayjs(order.plannedStartAt);
  const window = payload.plannedStartAt && payload.plannedEndAt
    ? { startAt, endAt: dayjs(payload.plannedEndAt) }
    : buildScheduleWindow(data, payload.lineCode, startAt, plan.workHours, payload.cleanMinutes);
  if (!window.endAt.isAfter(window.startAt)) throw new Error('计划结束必须晚于计划开始');
  validateNoLineOverlap(data, order.id, payload.lineCode, window.startAt, window.endAt);
  return {
    ...order,
    status: '已排程',
    lineCode: payload.lineCode,
    singlePotOutput: payload.singlePotOutput,
    singlePotWorkHours: payload.singlePotWorkHours,
    cleanMinutes: payload.cleanMinutes,
    batchCount: plan.batchCount,
    workHours: plan.workHours,
    plannedStartAt: window.startAt.toISOString(),
    plannedEndAt: window.endAt.toISOString(),
    schedulePlanSource: 'manual',
    scheduleReason: '人工编辑排程方案',
  };
};

export function createProductionOrderSchedulePlan(data: MesStateData, productionOrderId: string): ProductionOrder {
  return createAutoSchedulePlans(data, [productionOrderId])[0];
}

export function createProductionOrderSchedulePlans(data: MesStateData, productionOrderIds: string[]): ProductionOrder[] {
  return createAutoSchedulePlans(data, productionOrderIds);
}

export function updateProductionOrderSchedulePlan(
  data: MesStateData,
  productionOrderId: string,
  payload: ProductionOrderSchedulePlanPayload,
): ProductionOrder {
  const order = data.productionOrders.find((item) => item.id === productionOrderId);
  if (!order) throw new Error('生产订单不存在');
  if (data.scheduleItems.some((item) => item.productionOrderId === productionOrderId)) {
    throw new Error('该生产订单已输出排程单，无法编辑排程方案');
  }
  return applyPlanPayload(data, order, payload);
}

export function updateProductionOrderScheduleWindow(
  data: MesStateData,
  productionOrderId: string,
  payload: { lineCode: string; startAt: string; endAt: string },
): ProductionOrder {
  const order = data.productionOrders.find((item) => item.id === productionOrderId);
  if (!order) throw new Error('生产订单不存在');
  if (!order.singlePotOutput || order.singlePotWorkHours === undefined || order.cleanMinutes === undefined) {
    throw new Error('请先生成排程方案');
  }
  return applyPlanPayload(data, order, {
    lineCode: payload.lineCode,
    singlePotOutput: order.singlePotOutput,
    singlePotWorkHours: order.singlePotWorkHours,
    cleanMinutes: order.cleanMinutes,
    plannedStartAt: payload.startAt,
    plannedEndAt: payload.endAt,
  });
}

export function clearProductionOrderSchedulePlan(data: MesStateData, productionOrderId: string): ProductionOrder {
  const order = data.productionOrders.find((item) => item.id === productionOrderId);
  if (!order) throw new Error('生产订单不存在');
  if (data.scheduleItems.some((item) => item.productionOrderId === productionOrderId)) {
    throw new Error('该生产订单已输出排程单，无法从生产订单页撤回');
  }
  const { lineCode, singlePotOutput, singlePotWorkHours, plannedStartAt, plannedEndAt, workHours, cleanMinutes, batchCount, schedulePlanSource, scheduleReason, ...rest } = order;
  void lineCode; void singlePotOutput; void singlePotWorkHours; void plannedStartAt; void plannedEndAt; void workHours; void cleanMinutes; void batchCount; void schedulePlanSource; void scheduleReason;
  return { ...rest, status: '未排程' };
}

export function createScheduleItemsFromProductionOrders(data: MesStateData, productionOrderIds: string[]): ScheduleItem[] {
  if (!productionOrderIds.length) throw new Error('请选择要下推的生产订单');
  const existingOrderIds = new Set(data.scheduleItems.map((item) => item.productionOrderId));
  return [...new Set(productionOrderIds)].map((id) => {
    const order = data.productionOrders.find((item) => item.id === id);
    if (!order) throw new Error(`生产订单 ${id} 不存在`);
    if (order.status !== '已排程' || !hasSchedulePlan(order)) throw new Error(`生产订单 ${id} 尚未完成排程`);
    if (existingOrderIds.has(id)) throw new Error(`生产订单 ${id} 已输出排程单`);
    return {
      id: `SCH-${order.id}`,
      productionOrderId: order.id,
      productCode: order.productCode,
      lineCode: order.lineCode!,
      startAt: order.plannedStartAt!,
      endAt: order.plannedEndAt!,
      batchCount: order.batchCount!,
      workHours: order.workHours!,
      cleanMinutes: order.cleanMinutes ?? 0,
      singlePotOutput: order.singlePotOutput ?? 1,
      singlePotWorkHours: order.singlePotWorkHours ?? 0,
      status: '待下推',
    };
  });
}

export function getSchedulePushdownDetail(data: MesStateData, scheduleItemId: string) {
  const scheduleItem = data.scheduleItems.find((item) => item.id === scheduleItemId);
  if (!scheduleItem) return null;
  const productionOrder = data.productionOrders.find((item) => item.id === scheduleItem.productionOrderId);
  const workOrders = data.batchWorkOrders.filter((item) => item.productionOrderId === scheduleItem.productionOrderId);
  const workOrderIds = new Set(workOrders.map((item) => item.id));
  const formulas = data.formulaSheets.filter((item) => workOrderIds.has(item.batchWorkOrderId));
  const hasFeedRecords = data.feedRecords.some((item) => item.batchWorkOrderId && workOrderIds.has(item.batchWorkOrderId));
  const hasExecutionRecords = data.executionRecords.some((item) => workOrderIds.has(item.batchWorkOrderId));
  let recallBlockReason: string | undefined;
  if (scheduleItem.status === '执行中' || scheduleItem.status === '已完成') {
    recallBlockReason = '排程单已开工或已完成，无法撤回';
  } else if (scheduleItem.status === '待执行' && workOrders.some((item) => !recallableBatchStatuses.includes(item.status))) {
    recallBlockReason = '关联批次工单已开工或已完成，无法撤回';
  } else if (scheduleItem.status === '待执行' && (hasFeedRecords || hasExecutionRecords)) {
    recallBlockReason = '已产生投料或执行记录，无法撤回';
  }
  return {
    scheduleItem,
    productionOrder,
    workOrders,
    formulas,
    canRecall: !recallBlockReason,
    recallBlockReason,
  };
}

export function recallScheduleOutput(data: MesStateData, scheduleItemIds: string[]) {
  if (!scheduleItemIds.length) throw new Error('请选择要撤回的排程单');
  const details = scheduleItemIds.map((scheduleItemId) => {
    const detail = getSchedulePushdownDetail(data, scheduleItemId);
    if (!detail) throw new Error(`排程单 ${scheduleItemId} 不存在`);
    if (detail.scheduleItem.status !== '待下推') throw new Error('仅待下推排程单可撤回输出');
    return detail;
  });
  const recalledScheduleIds = new Set(details.map((item) => item.scheduleItem.id));
  return {
    scheduleItems: data.scheduleItems.filter((item) => !recalledScheduleIds.has(item.id)),
  };
}

export function recallSchedulePushdown(data: MesStateData, scheduleItemIds: string[]) {
  if (!scheduleItemIds.length) throw new Error('请选择要撤回下推的排程单');
  const details = scheduleItemIds.map((scheduleItemId) => {
    const detail = getSchedulePushdownDetail(data, scheduleItemId);
    if (!detail) throw new Error(`排程单 ${scheduleItemId} 不存在`);
    if (detail.scheduleItem.status !== '待执行') throw new Error('仅待执行排程单可撤回下推');
    if (!detail.canRecall) throw new Error(detail.recallBlockReason ?? `排程单 ${scheduleItemId} 不可撤回`);
    return detail;
  });
  const recalledScheduleIds = new Set(details.map((item) => item.scheduleItem.id));
  const recalledWorkOrderIds = new Set(details.flatMap((item) => item.workOrders.map((workOrder) => workOrder.id)));
  return {
    scheduleItems: data.scheduleItems.map((item) => recalledScheduleIds.has(item.id) ? { ...item, status: '待下推' as const } : item),
    batchWorkOrders: data.batchWorkOrders.filter((item) => !recalledWorkOrderIds.has(item.id)),
    formulaSheets: data.formulaSheets.filter((item) => !recalledWorkOrderIds.has(item.batchWorkOrderId)),
  };
}

export function syncScheduleItemStatuses(
  scheduleItems: ScheduleItem[],
  batchWorkOrders: MesStateData['batchWorkOrders'],
): ScheduleItem[] {
  return scheduleItems.map((item) => {
    if (item.status === '待下推') return item;
    const related = batchWorkOrders.filter((workOrder) => workOrder.productionOrderId === item.productionOrderId);
    if (!related.length) return item;
    if (related.every((workOrder) => workOrder.status === '已完成')) return { ...item, status: '已完成' as const };
    if (related.some((workOrder) => workOrder.status === '执行中' || workOrder.status === '暂停中')) return { ...item, status: '执行中' as const };
    return { ...item, status: '待执行' as const };
  });
}

export function normalizeScheduleItem(item: ScheduleItem & { locked?: boolean }): ScheduleItem {
  const persistedStatus = item.status as string | undefined;
  const status = persistedStatus === '未下推' ? '待下推' : item.status ?? (item.locked ? '待执行' : '待下推');
  return {
    id: item.id,
    productionOrderId: item.productionOrderId,
    productCode: item.productCode,
    lineCode: item.lineCode,
    startAt: item.startAt,
    endAt: item.endAt,
    batchCount: item.batchCount,
    workHours: item.workHours,
    cleanMinutes: item.cleanMinutes,
    singlePotOutput: item.singlePotOutput ?? 1,
    singlePotWorkHours: item.singlePotWorkHours ?? 0,
    status: status as ScheduleItemStatus,
  };
}

export function normalizeProductionOrderStatus(status?: string): ProductionOrder['status'] {
  if (status === '已排程') return '已排程';
  return '未排程';
}
