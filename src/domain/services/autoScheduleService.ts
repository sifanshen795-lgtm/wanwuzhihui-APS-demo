import dayjs, { type Dayjs } from 'dayjs';
import type { LineProductRelation, MesStateData, ProductionOrder, ScheduleRule } from '../models/mes';
import { addWorkingMinutes, getWorkMinutesUntilBreak, hasLineCalendar, nextWorkingTime } from './calendarService';

const durationToHours = (duration: number, unit: '分钟' | '小时') => (unit === '分钟' ? duration / 60 : duration);
const durationToMinutes = (duration: number, unit: '分钟' | '小时') => (unit === '小时' ? duration * 60 : duration);
const priorityRank: Record<string, number> = { 高: 3, 中: 2, 低: 1 };
const kitReadyRank: Record<ProductionOrder['kitReadyStatus'], number> = { 齐套: 3, 部分齐套: 2, 不齐套: 1 };
const MAX_WINDOW_SEARCH_STEPS = 1000;

export type LineCandidate = {
  lineCode: string;
  singlePotOutput: number;
  singlePotWorkHours: number;
  cleanMinutes: number;
  productionPriority: string;
};

export type LineOccupancyItem = {
  productionOrderId: string;
  productCode: string;
  lineCode: string;
  startAt: Dayjs;
  endAt: Dayjs;
  source: 'scheduleItem' | 'manualPlan' | 'autoPlan';
};

export type ScheduleWindow = {
  startAt: Dayjs;
  endAt: Dayjs;
  availableWindowMinutes: number;
};

export type CreateAutoSchedulePlanOptions = {
  startBase?: Dayjs;
  rescheduleProductionOrderIds?: string[];
};

const hasSchedulePlan = (order: ProductionOrder) =>
  Boolean(order.lineCode && order.plannedStartAt && order.plannedEndAt && order.batchCount && order.workHours !== undefined);

const getDefaultStartBase = () => dayjs().add(1, 'day').hour(8).minute(0).second(0).millisecond(0);

const compareNullableDate = (left?: string, right?: string) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return dayjs(left).valueOf() - dayjs(right).valueOf();
};

const getColorSort = (data: MesStateData, productCode: string) => {
  const material = data.materials.find((item) => item.code === productCode);
  if (!material?.colorGradeCode) return Number.MAX_SAFE_INTEGER;
  return data.colorGrades.find((item) => item.code === material.colorGradeCode)?.sort ?? Number.MAX_SAFE_INTEGER;
};

const getProductGroupCodes = (data: MesStateData, productCode: string) =>
  data.productGroupRelations
    .filter((item) => item.enabled && item.materials.includes(productCode))
    .map((item) => item.code);

const sameProductClass = (data: MesStateData, leftProductCode?: string, rightProductCode?: string) => {
  if (!leftProductCode || !rightProductCode) return false;
  if (leftProductCode === rightProductCode) return true;
  const leftGroups = getProductGroupCodes(data, leftProductCode);
  const rightGroups = new Set(getProductGroupCodes(data, rightProductCode));
  return leftGroups.some((groupCode) => rightGroups.has(groupCode));
};

const getEnabledRuleCodes = (rules: ScheduleRule[]) => new Set(rules.map((rule) => rule.code));

const calculatePlan = (quantity: number, candidate: Pick<LineCandidate, 'singlePotOutput' | 'singlePotWorkHours' | 'cleanMinutes'>) => {
  const safeSinglePotOutput = Math.max(1, Number(candidate.singlePotOutput) || 1);
  const batchCount = Math.max(1, Math.ceil(quantity / safeSinglePotOutput));
  const workHours = Number((batchCount * Math.max(0, Number(candidate.singlePotWorkHours) || 0) + Math.max(0, Number(candidate.cleanMinutes) || 0) / 60).toFixed(2));
  const durationMinutes = Math.max(1, Math.round(workHours * 60));
  return { batchCount, workHours, durationMinutes };
};

const relationToCandidate = (relation: LineProductRelation): LineCandidate => ({
  lineCode: relation.lineCode,
  singlePotOutput: relation.singlePotOutput,
  singlePotWorkHours: Number(durationToHours(relation.intervalDuration, relation.intervalUnit).toFixed(2)),
  cleanMinutes: durationToMinutes(relation.cleanDuration, relation.cleanUnit),
  productionPriority: relation.productionPriority,
});

const normalizeOccupancy = (items: LineOccupancyItem[]) =>
  items.slice().sort((a, b) => a.startAt.valueOf() - b.startAt.valueOf() || a.endAt.valueOf() - b.endAt.valueOf());

const findPreviousOccupancy = (occupancy: Map<string, LineOccupancyItem[]>, lineCode: string, startAt: Dayjs) =>
  (occupancy.get(lineCode) ?? [])
    .filter((item) => item.endAt.isSame(startAt) || item.endAt.isBefore(startAt))
    .sort((a, b) => b.endAt.valueOf() - a.endAt.valueOf())[0];

export const getDeliveryRiskMinutes = (order: ProductionOrder) => {
  if (!order.plannedEndAt) return 0;
  return Math.max(0, dayjs(order.plannedEndAt).diff(dayjs(order.deliveryDate).endOf('day'), 'minute'));
};

export const formatOverdueText = (minutes: number) => {
  if (minutes <= 0) return '';
  const days = Math.floor(minutes / 1440);
  const hours = Math.ceil((minutes % 1440) / 60);
  if (days && hours) return `超期 ${days} 天 ${hours} 小时`;
  if (days) return `超期 ${days} 天`;
  return `超期 ${Math.max(1, hours)} 小时`;
};

const buildScheduleReason = (
  data: MesStateData,
  order: ProductionOrder,
  candidate: LineCandidate,
  window: ScheduleWindow,
  rules: ScheduleRule[],
) => {
  const deliveryEnd = dayjs(order.deliveryDate).endOf('day');
  const overdueMinutes = Math.max(0, window.endAt.diff(deliveryEnd, 'minute'));
  const enabledRuleNames = rules.map((rule) => rule.name.replace('生产', '')).join(' / ');
  const windowText = Number.isFinite(window.availableWindowMinutes)
    ? `休息前可用 ${window.availableWindowMinutes} 分钟`
    : '连续可用';
  return [
    enabledRuleNames || '默认自动排程',
    `${candidate.lineCode} 最早可用 ${window.startAt.format('MM-DD HH:mm')}`,
    `交期 ${order.deliveryDate}`,
    windowText,
    overdueMinutes > 0 ? formatOverdueText(overdueMinutes) : '交期内完成',
    data.scheduleItems.some((item) => item.productionOrderId === order.id) ? '已输出锁定' : undefined,
  ].filter(Boolean).join('；');
};

export const getEnabledScheduleRules = (data: Pick<MesStateData, 'scheduleRules'>) =>
  [...(data.scheduleRules ?? [])]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));

const compareByRule = (data: MesStateData, left: ProductionOrder, right: ProductionOrder, rule: ScheduleRule) => {
  if (rule.code === 'materialReadyFirst') {
    const rankDiff = (kitReadyRank[right.kitReadyStatus] ?? 0) - (kitReadyRank[left.kitReadyStatus] ?? 0);
    if (rankDiff) return rankDiff;
    const leftRatio = left.quantity ? (left.kitReadyQuantity ?? 0) / left.quantity : 0;
    const rightRatio = right.quantity ? (right.kitReadyQuantity ?? 0) / right.quantity : 0;
    if (rightRatio !== leftRatio) return rightRatio - leftRatio;
  }
  if (rule.code === 'deliveryUrgency') {
    const diff = compareNullableDate(left.deliveryDate, right.deliveryDate);
    if (diff) return diff;
  }
  if (rule.code === 'lightToDark') {
    const diff = getColorSort(data, left.productCode) - getColorSort(data, right.productCode);
    if (diff) return diff;
  }
  return 0;
};

const getShortestDurationMinutes = (data: MesStateData, order: ProductionOrder) => {
  const candidates = resolveLineCandidates(data, order);
  if (!candidates.length) return Number.POSITIVE_INFINITY;
  return Math.min(...candidates.map((candidate) => calculatePlan(order.quantity, candidate).durationMinutes));
};

export const sortProductionOrdersForSchedule = (
  data: MesStateData,
  orders: ProductionOrder[],
  context: { startBase?: Dayjs } = {},
) => {
  const rules = getEnabledScheduleRules(data);
  const startBase = context.startBase ?? getDefaultStartBase();
  return [...orders].sort((left, right) => {
    for (const rule of rules) {
      const diff = compareByRule(data, left, right, rule);
      if (diff) return diff;
    }

    const leftDuration = getShortestDurationMinutes(data, left);
    const rightDuration = getShortestDurationMinutes(data, right);
    const leftWindow = Math.max(...resolveLineCandidates(data, left).map((candidate) => getWorkMinutesUntilBreak(data, candidate.lineCode, startBase)));
    const rightWindow = Math.max(...resolveLineCandidates(data, right).map((candidate) => getWorkMinutesUntilBreak(data, candidate.lineCode, startBase)));
    const leftFits = leftDuration <= leftWindow;
    const rightFits = rightDuration <= rightWindow;
    if (leftFits !== rightFits) return leftFits ? -1 : 1;
    if (leftFits && rightFits) {
      const leftFill = leftWindow ? leftDuration / leftWindow : 0;
      const rightFill = rightWindow ? rightDuration / rightWindow : 0;
      if (leftFill !== rightFill) return rightFill - leftFill;
    }

    return compareNullableDate(left.deliveryDate, right.deliveryDate)
      || left.productCode.localeCompare(right.productCode)
      || left.id.localeCompare(right.id);
  });
};

export const resolveLineCandidates = (data: MesStateData, productionOrder: ProductionOrder) =>
  data.lineProductRelations
    .filter((relation) => (
      relation.enabled
      && relation.productCode === productionOrder.productCode
      && data.lines.some((line) => line.code === relation.lineCode && line.enabled)
      && relation.singlePotOutput > 0
      && relation.intervalDuration > 0
    ))
    .map(relationToCandidate)
    .sort((a, b) => (priorityRank[b.productionPriority] ?? 0) - (priorityRank[a.productionPriority] ?? 0) || a.lineCode.localeCompare(b.lineCode));

export const buildLineOccupancy = (
  data: MesStateData,
  options: { excludeProductionOrderIds?: string[] } = {},
) => {
  const excludeIds = new Set(options.excludeProductionOrderIds ?? []);
  const occupancy = new Map<string, LineOccupancyItem[]>();
  const push = (item: LineOccupancyItem) => {
    occupancy.set(item.lineCode, normalizeOccupancy([...(occupancy.get(item.lineCode) ?? []), item]));
  };

  data.scheduleItems.forEach((item) => {
    push({
      productionOrderId: item.productionOrderId,
      productCode: item.productCode,
      lineCode: item.lineCode,
      startAt: dayjs(item.startAt),
      endAt: dayjs(item.endAt),
      source: 'scheduleItem',
    });
  });

  data.productionOrders.filter(hasSchedulePlan).forEach((order) => {
    if (excludeIds.has(order.id)) return;
    if (!order.lineCode || !order.plannedStartAt || !order.plannedEndAt) return;
    if (data.scheduleItems.some((item) => item.productionOrderId === order.id)) return;
    push({
      productionOrderId: order.id,
      productCode: order.productCode,
      lineCode: order.lineCode,
      startAt: dayjs(order.plannedStartAt),
      endAt: dayjs(order.plannedEndAt),
      source: order.schedulePlanSource === 'auto' ? 'autoPlan' : 'manualPlan',
    });
  });

  return occupancy;
};

const buildWindow = (data: MesStateData, lineCode: string, startAt: Dayjs, durationMinutes: number): ScheduleWindow => {
  if (!hasLineCalendar(data, lineCode)) {
    return {
      startAt,
      endAt: startAt.add(durationMinutes, 'minute'),
      availableWindowMinutes: Number.POSITIVE_INFINITY,
    };
  }
  const workingStart = nextWorkingTime(data, lineCode, startAt);
  return {
    startAt: workingStart,
    endAt: addWorkingMinutes(data, lineCode, workingStart, durationMinutes),
    availableWindowMinutes: getWorkMinutesUntilBreak(data, lineCode, workingStart),
  };
};

export const findEarliestAvailableWindow = (
  data: MesStateData,
  lineCode: string,
  durationMinutes: number,
  occupancy: Map<string, LineOccupancyItem[]>,
  startBase: Dayjs = getDefaultStartBase(),
) => {
  let cursor = startBase;
  for (let step = 0; step < MAX_WINDOW_SEARCH_STEPS; step += 1) {
    const window = buildWindow(data, lineCode, cursor, durationMinutes);
    const overlap = (occupancy.get(lineCode) ?? []).find((item) => window.startAt.isBefore(item.endAt) && window.endAt.isAfter(item.startAt));
    if (!overlap) return window;
    cursor = overlap.endAt.isAfter(window.startAt) ? overlap.endAt : window.startAt.add(1, 'minute');
  }
  throw new Error(`产线 ${lineCode} 在可搜索范围内未找到可用窗口`);
};

export const scoreLineCandidate = (
  data: MesStateData,
  order: ProductionOrder,
  candidate: LineCandidate,
  window: ScheduleWindow,
  context: { rules: ScheduleRule[]; occupancy: Map<string, LineOccupancyItem[]>; durationMinutes: number },
) => {
  const ruleCodes = getEnabledRuleCodes(context.rules);
  const previous = findPreviousOccupancy(context.occupancy, candidate.lineCode, window.startAt);
  const deliveryEnd = dayjs(order.deliveryDate).endOf('day');
  const overdueMinutes = Math.max(0, window.endAt.diff(deliveryEnd, 'minute'));
  const sameProductPenalty = ruleCodes.has('sameProductFirst') && previous?.productCode === order.productCode ? -1 : 0;
  const sameClassPenalty = ruleCodes.has('sameProductClassFirst') && sameProductClass(data, previous?.productCode, order.productCode) ? -1 : 0;
  const colorPenalty = ruleCodes.has('lightToDark') && previous && getColorSort(data, previous.productCode) > getColorSort(data, order.productCode) ? 1 : 0;
  const fillPenalty = context.durationMinutes <= window.availableWindowMinutes
    ? 1 - (context.durationMinutes / window.availableWindowMinutes)
    : 1;

  return [
    overdueMinutes > 0 ? 1 : 0,
    overdueMinutes,
    window.startAt.valueOf(),
    -(priorityRank[candidate.productionPriority] ?? 0),
    sameProductPenalty,
    sameClassPenalty,
    colorPenalty,
    fillPenalty,
    window.endAt.valueOf(),
    candidate.lineCode.charCodeAt(0),
  ];
};

const compareScore = (left: number[], right: number[]) => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff) return diff;
  }
  return 0;
};

export const createAutoSchedulePlans = (
  data: MesStateData,
  productionOrderIds: string[],
  options: CreateAutoSchedulePlanOptions = {},
) => {
  if (!productionOrderIds.length) throw new Error('请选择要下推排程的生产订单');
  const uniqueIds = [...new Set(productionOrderIds)];
  const outputOrderIds = new Set(data.scheduleItems.map((item) => item.productionOrderId));
  const orders = uniqueIds.map((id) => {
    const order = data.productionOrders.find((item) => item.id === id);
    if (!order) throw new Error(`生产订单 ${id} 不存在`);
    if (outputOrderIds.has(id)) throw new Error(`生产订单 ${id} 已输出排程单`);
    if (order.status !== '未排程' && !options.rescheduleProductionOrderIds?.includes(id)) {
      throw new Error(`生产订单 ${id} 不是未排程状态`);
    }
    return order;
  });
  const startBase = options.startBase ?? getDefaultStartBase();
  const rules = getEnabledScheduleRules(data);
  const ordered = sortProductionOrdersForSchedule(data, orders, { startBase });
  const occupancy = buildLineOccupancy(data, { excludeProductionOrderIds: uniqueIds });
  const plannedOrders: ProductionOrder[] = [];

  ordered.forEach((order) => {
    const candidates = resolveLineCandidates(data, order);
    if (!candidates.length) throw new Error(`产品 ${order.productCode} 未配置可用产线`);

    const evaluated = candidates.map((candidate) => {
      const plan = calculatePlan(order.quantity, candidate);
      const window = findEarliestAvailableWindow(data, candidate.lineCode, plan.durationMinutes, occupancy, startBase);
      return {
        candidate,
        plan,
        window,
        score: scoreLineCandidate(data, order, candidate, window, {
          rules,
          occupancy,
          durationMinutes: plan.durationMinutes,
        }),
      };
    }).sort((a, b) => compareScore(a.score, b.score) || a.candidate.lineCode.localeCompare(b.candidate.lineCode));

    const best = evaluated[0];
    occupancy.set(best.candidate.lineCode, normalizeOccupancy([...(occupancy.get(best.candidate.lineCode) ?? []), {
      productionOrderId: order.id,
      productCode: order.productCode,
      lineCode: best.candidate.lineCode,
      startAt: best.window.startAt,
      endAt: best.window.endAt,
      source: 'autoPlan',
    }]));
    plannedOrders.push({
      ...order,
      status: '已排程',
      lineCode: best.candidate.lineCode,
      singlePotOutput: best.candidate.singlePotOutput,
      singlePotWorkHours: best.candidate.singlePotWorkHours,
      cleanMinutes: best.candidate.cleanMinutes,
      batchCount: best.plan.batchCount,
      workHours: best.plan.workHours,
      plannedStartAt: best.window.startAt.toISOString(),
      plannedEndAt: best.window.endAt.toISOString(),
      schedulePlanSource: 'auto',
      scheduleReason: buildScheduleReason(data, order, best.candidate, best.window, rules),
    });
  });

  return plannedOrders.sort((a, b) => uniqueIds.indexOf(a.id) - uniqueIds.indexOf(b.id));
};
