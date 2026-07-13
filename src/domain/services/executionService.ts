import type { BarcodeArchive, FeedRecord, InventoryItem, LossRecord, MesStateData, PackageRecord, TransferRecord, WorkOrderExecutionRecord } from '../models/mes';
import { makeId, nowIso } from './helpers';

const barcodeStatus = (remaining: number): BarcodeArchive['status'] => {
  if (remaining <= 0) return '已用完';
  return '部分使用';
};

export function feedByBarcode(data: MesStateData, batchWorkOrderId: string, barcodeCode: string, actualQuantity: number, feedPort?: string, nextRemainingQuantity?: number) {
  const workOrder = data.batchWorkOrders.find((item) => item.id === batchWorkOrderId);
  const formula = data.formulaSheets.find((item) => item.batchWorkOrderId === batchWorkOrderId);
  const barcode = data.barcodes.find((item) => item.code === barcodeCode);
  if (!workOrder || !formula || !barcode) throw new Error('工单、配方或条码不存在');
  if (formula.status !== '已审核') throw new Error('配方未审核，不能投料');
  if (barcode.inventoryStatus !== '库外') throw new Error('条码库存状态不是库外，不能投料');

  const formulaLine = formula.lines.find((line) => line.materialCode === barcode.materialCode);
  if (!formulaLine) throw new Error('条码物料不在配方中');
  if (formulaLine.specifiedFeedPort && formulaLine.specifiedFeedPort !== feedPort) throw new Error('投料口不匹配');
  const specifiedBatchNos = formulaLine.specifiedBatches?.length
    ? formulaLine.specifiedBatches.map((item) => item.batchNo)
    : formulaLine.specifiedBatchNo ? [formulaLine.specifiedBatchNo] : [];
  if (specifiedBatchNos.length && !specifiedBatchNos.includes(barcode.batchNo)) throw new Error('批号不匹配');
  if (barcode.remainingQuantity < actualQuantity) throw new Error('条码剩余量不足');

  const remainingQuantity = Number((nextRemainingQuantity ?? barcode.remainingQuantity - actualQuantity).toFixed(2));
  if (remainingQuantity < 0) throw new Error('条码剩余量不能小于 0');
  if (remainingQuantity > barcode.remainingQuantity - actualQuantity) throw new Error('条码剩余量不能大于扫码前剩余量减本次投料量');
  const lossQuantity = Number((barcode.remainingQuantity - actualQuantity - remainingQuantity).toFixed(2));
  const consumedQuantity = Number((barcode.remainingQuantity - remainingQuantity).toFixed(2));
  const feedRecord: FeedRecord = {
    id: `FEED-${data.feedRecords.length + 1}`,
    batchWorkOrderId,
    formulaSheetId: formula.id,
    feedPort,
    barcodeCode,
    materialCode: barcode.materialCode,
    batchNo: barcode.batchNo,
    theoreticalQuantity: formulaLine.formulaQuantity,
    actualQuantity,
    remainingQuantity,
    fedAt: nowIso(),
  };

  const inventory: InventoryItem[] = data.inventory.map((item) => {
    if (item.materialCode === barcode.materialCode && item.batchNo === barcode.batchNo) {
      return { ...item, quantity: Math.max(0, Number((item.quantity - consumedQuantity).toFixed(2))), updatedAt: nowIso() };
    }
    return item;
  });

  return {
    feedRecord,
    barcode: { ...barcode, remainingQuantity, status: barcodeStatus(remainingQuantity), inventoryStatus: remainingQuantity <= 0 ? '库外' as const : barcode.inventoryStatus ?? '库内' },
    inventory,
    workOrder: { ...workOrder, status: '执行中' as const },
    lossRecord: lossQuantity > 0 ? createLossRecord(data, barcode, lossQuantity, batchWorkOrderId) : undefined,
  };
}

export function feedFromTank(data: MesStateData, batchWorkOrderId: string, tankCode: string, before: number, after: number) {
  const workOrder = data.batchWorkOrders.find((item) => item.id === batchWorkOrderId);
  const formula = data.formulaSheets.find((item) => item.batchWorkOrderId === batchWorkOrderId);
  const tank = data.tanks.find((item) => item.code === tankCode);
  if (!workOrder || !formula || !tank) throw new Error('工单、配方或储罐不存在');
  if (formula.status !== '已审核') throw new Error('配方未审核，不能投料');
  const actualQuantity = Number((before - after).toFixed(2));
  if (actualQuantity <= 0) throw new Error('生产后储罐数量必须小于生产前数量');

  const formulaLine = formula.lines.find((line) => line.materialCode === tank.materialCode);
  const feedRecord: FeedRecord = {
    id: `FEED-${data.feedRecords.length + 1}`,
    batchWorkOrderId,
    formulaSheetId: formula.id,
    tankCode,
    materialCode: tank.materialCode,
    batchNo: tank.code,
    theoreticalQuantity: formulaLine?.formulaQuantity ?? actualQuantity,
    actualQuantity,
    remainingQuantity: after,
    fedAt: nowIso(),
  };

  const inventory = data.inventory.map((item) => item.id === `INV-${tank.code}` ? { ...item, quantity: after, updatedAt: nowIso() } : item);
  return { feedRecord, tank: { ...tank, currentQuantity: after }, inventory, workOrder: { ...workOrder, status: '执行中' as const } };
}

export function packageWorkOrder(data: MesStateData, batchWorkOrderId: string, weight: number) {
  const workOrder = data.batchWorkOrders.find((item) => item.id === batchWorkOrderId);
  if (!workOrder) throw new Error('工单不存在');
  const material = data.materials.find((item) => item.code === workOrder.materialCode);
  if (!material) throw new Error('物料不存在');
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('包装重量必须大于 0');

  const packageNo = data.packageRecords.filter((item) => item.batchWorkOrderId === batchWorkOrderId).length + 1;
  const barcodeCode = `BC-${workOrder.materialCode}-${String(data.barcodes.length + 1).padStart(3, '0')}`;
  const batchNo = `${workOrder.id}-PK${packageNo}`;
  const barcode: BarcodeArchive = {
    code: barcodeCode,
    type: workOrder.type === '主产品' ? '成品' : '中间物料',
    materialCode: workOrder.materialCode,
    batchNo,
    initialQuantity: weight,
    remainingQuantity: weight,
    unit: workOrder.unit,
    source: batchWorkOrderId,
    status: '可用',
    inventoryStatus: '库外',
    createdAt: nowIso(),
  };
  const packageRecord: PackageRecord = {
    id: `PKG-${data.packageRecords.length + 1}`,
    batchWorkOrderId,
    packageNo,
    materialCode: workOrder.materialCode,
    weight,
    barcodeCode,
    packagedAt: nowIso(),
  };
  const inventoryItem: InventoryItem = {
    id: `INV-${barcodeCode}`,
    materialCode: workOrder.materialCode,
    materialType: workOrder.type === '主产品' ? '成品' : '中间物料',
    batchNo,
    quantity: weight,
    unit: workOrder.unit,
    source: 'MES',
    inventoryKind: '即时库存',
    inventoryLocation: '线边仓',
    updatedAt: nowIso(),
  };
  const packedQuantity = data.packageRecords
    .filter((item) => item.batchWorkOrderId === batchWorkOrderId)
    .reduce((sum, item) => sum + item.weight, 0) + weight;
  return {
    barcode,
    packageRecord,
    inventoryItem,
    workOrder: { ...workOrder, status: packedQuantity >= workOrder.plannedQuantity ? '已完成' as const : '执行中' as const },
  };
}

export function transferToTank(data: MesStateData, barcodeCode: string, tankCode: string, quantity: number) {
  const barcode = data.barcodes.find((item) => item.code === barcodeCode);
  const tank = data.tanks.find((item) => item.code === tankCode);
  if (!barcode || !tank) throw new Error('条码或储罐不存在');
  if (barcode.materialCode !== tank.materialCode) throw new Error('条码物料与储罐物料不一致');
  if (barcode.remainingQuantity < quantity) throw new Error('条码剩余量不足');

  const remainingQuantity = Number((barcode.remainingQuantity - quantity).toFixed(2));
  const transferRecord: TransferRecord = {
    id: `TR-${data.transferRecords.length + 1}`,
    sourceBarcodeCode: barcodeCode,
    sourceBatchNo: barcode.batchNo,
    targetTankCode: tankCode,
    quantity,
    transferredAt: nowIso(),
  };
  const inventory = data.inventory.map((item) => {
    if (item.materialCode === barcode.materialCode && item.batchNo === barcode.batchNo) return { ...item, quantity: Math.max(0, item.quantity - quantity), updatedAt: nowIso() };
    if (item.id === `INV-${tankCode}`) return { ...item, quantity: item.quantity + quantity, updatedAt: nowIso() };
    return item;
  });
  return {
    transferRecord,
    barcode: { ...barcode, remainingQuantity, status: barcodeStatus(remainingQuantity), inventoryStatus: remainingQuantity <= 0 ? '库外' as const : barcode.inventoryStatus ?? '库内' },
    tank: { ...tank, currentQuantity: Number((tank.currentQuantity + quantity).toFixed(2)) },
    inventory,
  };
}

export function makeExecutionRecord(data: MesStateData, batchWorkOrderId: string, action: string): WorkOrderExecutionRecord {
  return { id: `EXEC-${data.executionRecords.length + 1}`, batchWorkOrderId, action, status: '完成', startAt: nowIso(), endAt: nowIso(), remark: 'Demo 模拟记录' };
}

export function createLossRecord(data: MesStateData, barcode: BarcodeArchive, quantity: number, batchWorkOrderId?: string): LossRecord {
  return { id: `LOSS-${data.lossRecords.length + 1}`, source: '尾料损耗', batchWorkOrderId, barcodeCode: barcode.code, materialCode: barcode.materialCode, batchNo: barcode.batchNo, quantity, unit: barcode.unit, createdAt: nowIso() };
}
