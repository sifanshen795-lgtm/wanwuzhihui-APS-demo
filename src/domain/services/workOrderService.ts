import dayjs from 'dayjs';
import type { BatchWorkOrder, MesStateData } from '../models/mes';
import { getSelfMadeDirectChildRequirements } from './bomRequirementService';

const durationToHours = (duration: number, unit: '分钟' | '小时') => (unit === '分钟' ? duration / 60 : duration);
const stageSuffixMap = {
  配色: 'COLOR',
  配料: 'MIX',
  挤出: 'EXT',
} as const;

const toAlphaSuffix = (index: number) => {
  let value = index + 1;
  let suffix = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    suffix = String.fromCharCode(65 + remainder) + suffix;
    value = Math.floor((value - 1) / 26);
  }
  return suffix;
};

const singleLineStages = ['配色', '配料'];

const resolveRequirementLine = (data: MesStateData, materialCode: string) => {
  const stage = data.productIntermediateRelations.find((item) => item.intermediateCode === materialCode)?.stage;
  if (stage && singleLineStages.includes(stage)) {
    const line = data.lines.find((item) => item.enabled && item.stage === stage);
    if (line) return { line };
  }
  const relation = data.lineProductRelations.find((item) => item.enabled && item.productCode === materialCode && data.lines.some((line) => line.enabled && line.code === item.lineCode));
  const line = data.lines.find((item) => item.code === relation?.lineCode);
  return { relation, line };
};

const resolveProductionCraftCode = (data: MesStateData, materialCode: string) =>
  data.productionCrafts.find((craft) => craft.enabled && craft.materialCode === materialCode)?.code;

const createSelfMadeChildWorkOrders = (
  data: MesStateData,
  productionOrderId: string,
  parentTotalRequiredQuantity: number,
  parentWorkOrder: BatchWorkOrder,
): BatchWorkOrder[] => getSelfMadeDirectChildRequirements(data, productionOrderId, parentWorkOrder.materialCode)
  .flatMap((requirement, childIndex) => {
    const ratio = requirement.requiredQuantity / Math.max(1, parentTotalRequiredQuantity);
    const { line } = resolveRequirementLine(data, requirement.materialCode);
    const stage = line?.stage ?? '配料';
    const plannedQuantity = Number((parentWorkOrder.plannedQuantity * ratio).toFixed(2));
    const childWorkOrder: BatchWorkOrder = {
      id: `${parentWorkOrder.id}-${stageSuffixMap[stage]}-${requirement.materialCode}`,
      batchNo: `${parentWorkOrder.batchNo}-${toAlphaSuffix(childIndex)}`,
      type: '中间物料',
      stage,
      productionOrderId,
      parentBatchWorkOrderId: parentWorkOrder.id,
      materialCode: requirement.materialCode,
      productionCraftCode: resolveProductionCraftCode(data, requirement.materialCode),
      plannedQuantity,
      unit: requirement.unit,
      lineCode: line?.code ?? '',
      plannedStartAt: dayjs(parentWorkOrder.plannedStartAt).subtract(4, 'hour').toISOString(),
      plannedEndAt: dayjs(parentWorkOrder.plannedStartAt).subtract(2, 'hour').toISOString(),
      status: '待配方',
    };

    return [
      childWorkOrder,
      ...createSelfMadeChildWorkOrders(data, productionOrderId, requirement.requiredQuantity, childWorkOrder),
    ];
  });

export function generateBatchWorkOrders(data: MesStateData, scheduleItemIds?: string[]): BatchWorkOrder[] {
  const created: BatchWorkOrder[] = [];
  const selectedScheduleIds = scheduleItemIds ? new Set(scheduleItemIds) : null;

  data.scheduleItems
    .filter((item) => item.status === '待下推' && (!selectedScheduleIds || selectedScheduleIds.has(item.id)))
    .forEach((scheduleItem) => {
    const order = data.productionOrders.find((item) => item.id === scheduleItem.productionOrderId);
    if (!order) return;
    const singlePotOutput = scheduleItem.singlePotOutput;
    const intervalHours = scheduleItem.singlePotWorkHours;
    if (!singlePotOutput || intervalHours === undefined) return;

    const batchCount = scheduleItem.batchCount;
    for (let i = 1; i <= batchCount; i += 1) {
      const plannedQuantity = i < batchCount ? singlePotOutput : Math.max(0, order.quantity - singlePotOutput * (batchCount - 1));
      const batchId = `${order.id}-B${String(i).padStart(3, '0')}`;
      const batchNo = `${order.batchNo}-${String(i).padStart(3, '0')}`;
      const plannedStartAt = dayjs(scheduleItem.startAt).add((i - 1) * intervalHours, 'hour').toISOString();
      const plannedEndAt = dayjs(plannedStartAt).add(intervalHours, 'hour').toISOString();

      const mainWorkOrder: BatchWorkOrder = {
        id: batchId,
        batchNo,
        type: '主产品',
        stage: '挤出',
        productionOrderId: order.id,
        materialCode: order.productCode,
        productionCraftCode: resolveProductionCraftCode(data, order.productCode),
        plannedQuantity,
        unit: order.unit,
        lineCode: scheduleItem.lineCode,
        plannedStartAt,
        plannedEndAt,
        status: '待配方',
      };

      created.push(
        mainWorkOrder,
        ...createSelfMadeChildWorkOrders(data, order.id, order.quantity, mainWorkOrder),
      );
    }
  });

  return created;
}
