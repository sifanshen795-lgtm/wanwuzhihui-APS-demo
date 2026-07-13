import type { DemandSource } from '../enums';
import type { InventoryItem, InventoryKind, InventoryLocation, KitReadyStatus, MaterialRequirement, MaterialShortageSourceLine, MaterialShortageSummary, MesStateData, MrpAutoPushMergeField, MrpRunLog, ProductionOrder, SalesOrderShortageLine } from '../models/mes';
import { getReservedQuantityByMaterial } from './inventoryReservationService';
import { nowIso } from './helpers';

type RequirementBucket = {
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  inventoryQuantity: number;
  plannedInQuantity: number;
  plannedOutQuantity: number;
};

type InventorySupplyBucket = {
  date?: string;
  quantity: number;
};

type KitReadyFields = {
  kitReadyStatus: Exclude<KitReadyStatus, '未评估'>;
  kitReadyQuantity: number;
  materialReady: boolean;
};

const getInventoryKind = (item: InventoryItem) => item.inventoryKind ?? '即时库存';
const getInventoryLocation = (item: InventoryItem) => item.inventoryLocation ?? '仓库';

const getStandardBom = (data: MesStateData, productCode: string) => data.bomHeaders.find((item) => item.productCode === productCode && item.isStandard && item.status === '生效');

const getBomChildren = (data: MesStateData, bomCode: string, parentId?: string) => data.bomItems
  .filter((item) => item.bomCode === bomCode && (item.parentId ?? undefined) === (parentId ?? undefined))
  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

const buildBomPath = (path: string, materialCode: string) => (path ? `${path}/${materialCode}` : materialCode);

export const deriveKitReadyStatus = (kitReadyQuantity: number, quantity: number): Exclude<KitReadyStatus, '未评估'> => {
  if (kitReadyQuantity >= quantity) return '齐套';
  if (kitReadyQuantity > 0) return '部分齐套';
  return '不齐套';
};

export const buildProductionOrderKitReady = (quantity: number, availableKitReady: number): KitReadyFields => {
  const kitReadyQuantity = Number(Math.min(quantity, Math.max(0, availableKitReady)).toFixed(2));
  const kitReadyStatus = deriveKitReadyStatus(kitReadyQuantity, quantity);
  return {
    kitReadyQuantity,
    kitReadyStatus,
    materialReady: kitReadyStatus === '齐套',
  };
};

export const getConsumedKitReadyBySalesOrder = (productionOrders: ProductionOrder[]) => {
  const consumed = new Map<string, number>();
  productionOrders.forEach((productionOrder) => {
    const kitReadyQuantity = productionOrder.kitReadyQuantity ?? 0;
    if (!kitReadyQuantity) return;
    productionOrder.salesOrderAllocations.forEach((allocation) => {
      const share = allocation.quantity / Math.max(1, productionOrder.quantity);
      const current = consumed.get(allocation.salesOrderId) ?? 0;
      consumed.set(allocation.salesOrderId, Number((current + kitReadyQuantity * share).toFixed(2)));
    });
  });
  return consumed;
};

export const reserveMaterialFromProductionOrders = (
  materialRequirements: MaterialRequirement[],
  productionOrders: ProductionOrder[],
) => {
  const reservedByMaterial = new Map<string, number>();
  productionOrders.forEach((productionOrder) => {
    materialRequirements
      .filter((item) => item.productionOrderId === productionOrder.id && item.kitCheckTarget)
      .forEach((req) => {
        const current = reservedByMaterial.get(req.materialCode) ?? 0;
        reservedByMaterial.set(req.materialCode, Number((current + req.requiredQuantity).toFixed(2)));
      });
  });
  return reservedByMaterial;
};

export const attachKitReadyToProductionOrder = (
  productionOrder: ProductionOrder,
  salesOrders: MesStateData['salesOrders'],
  existingProductionOrders: ProductionOrder[],
  priorNewOrders: ProductionOrder[] = [],
): ProductionOrder => {
  const consumedKit = getConsumedKitReadyBySalesOrder([...existingProductionOrders, ...priorNewOrders]);
  let totalKitReady = 0;

  productionOrder.salesOrderAllocations.forEach((allocation) => {
    const salesOrder = salesOrders.find((item) => item.id === allocation.salesOrderId);
    const kitCapacity = salesOrder?.kitReadyQuantity ?? 0;
    const alreadyConsumed = consumedKit.get(allocation.salesOrderId) ?? 0;
    const available = Math.max(0, Number((kitCapacity - alreadyConsumed).toFixed(2)));
    const allocKitReady = Math.min(allocation.quantity, available);
    totalKitReady += allocKitReady;
    consumedKit.set(allocation.salesOrderId, Number((alreadyConsumed + allocKitReady).toFixed(2)));
  });

  const kit = buildProductionOrderKitReady(productionOrder.quantity, totalKitReady);
  return { ...productionOrder, ...kit };
};

const expandBomRequirements = (
  data: MesStateData,
  productionOrderId: string,
  rootProductCode: string,
  bomCode: string,
  quantity: number,
  parentRequirementId?: string,
  parentPath = rootProductCode,
  level = 1,
  parentMaterialCode?: string,
): MaterialRequirement[] => {
  const children = getBomChildren(data, bomCode, parentRequirementId);
  return children.flatMap((bomItem, index) => {
    const requiredQuantity = Number((quantity * bomItem.quantityPerUnit).toFixed(2));
    const requirementId = `${productionOrderId}-REQ-${parentPath}-${level}-${index + 1}`;
    const path = buildBomPath(parentPath, bomItem.materialCode);
    const descendants = expandBomRequirements(data, productionOrderId, rootProductCode, bomCode, requiredQuantity, bomItem.id, path, level + 1, bomItem.materialCode);
    const material = data.materials.find((item) => item.code === bomItem.materialCode);
    const requirement: MaterialRequirement = {
      id: requirementId,
      productionOrderId,
      rootProductCode,
      productCode: parentMaterialCode ?? rootProductCode,
      materialCode: bomItem.materialCode,
      materialAttr: material?.materialAttr ?? bomItem.materialAttr,
      requiredQuantity,
      unit: 'kg',
      feedPort: bomItem.feedPort,
      parentRequirementId,
      bomItemId: bomItem.id,
      bomLevel: level,
      bomPath: path,
      kitCheckTarget: descendants.length === 0,
    };
    return [requirement, ...descendants];
  });
};

const getInventorySnapshotQuantity = (
  items: InventoryItem[],
  materialCode: string,
  kind: InventoryKind,
  cutoffDate?: string,
  inventoryLocation?: InventoryLocation,
) => items
  .filter((item) => item.materialCode === materialCode
    && getInventoryKind(item) === kind
    && (!inventoryLocation || getInventoryLocation(item) === inventoryLocation)
    && (!cutoffDate || !item.plannedDate || item.plannedDate <= cutoffDate))
  .reduce((sum, item) => sum + item.quantity, 0);

export const getAvailableInventoryQuantity = (items: InventoryItem[], materialCode: string, cutoffDate?: string, inventoryLocation?: InventoryLocation) => {
  const inventoryQuantity = getInventorySnapshotQuantity(items, materialCode, '即时库存', cutoffDate, inventoryLocation);
  const plannedInQuantity = getInventorySnapshotQuantity(items, materialCode, '预计入库', cutoffDate, inventoryLocation);
  const plannedOutQuantity = getInventorySnapshotQuantity(items, materialCode, '预计出库', cutoffDate, inventoryLocation);
  return {
    inventoryQuantity,
    plannedInQuantity,
    plannedOutQuantity,
    availableQuantity: Number((inventoryQuantity + plannedInQuantity - plannedOutQuantity).toFixed(2)),
  };
};

export const getWarehouseBarcodeInventoryQuantity = (data: MesStateData, materialCode: string) => data.barcodes
  .filter((item) => item.materialCode === materialCode && (item.inventoryStatus ?? '库内') === '库内')
  .reduce((sum, item) => Number((sum + item.remainingQuantity).toFixed(2)), 0);

export const getLineSideInventoryQuantity = (data: MesStateData, materialCode: string) => {
  const barcodeQuantity = data.barcodes
    .filter((item) => item.materialCode === materialCode && item.inventoryStatus === '库外')
    .reduce((sum, item) => Number((sum + item.remainingQuantity).toFixed(2)), 0);
  const tankQuantity = data.tanks
    .filter((item) => item.materialCode === materialCode)
    .reduce((sum, item) => Number((sum + item.currentQuantity).toFixed(2)), 0);
  return Number((barcodeQuantity + tankQuantity).toFixed(2));
};

export const getAvailableInventoryQuantityFromData = (data: MesStateData, materialCode: string, cutoffDate?: string, inventoryLocation?: InventoryLocation) => {
  const snapshot = getAvailableInventoryQuantity(data.inventory, materialCode, cutoffDate, inventoryLocation);
  if (inventoryLocation === '线边仓') {
    const inventoryQuantity = getLineSideInventoryQuantity(data, materialCode);
    return {
      ...snapshot,
      inventoryQuantity,
      availableQuantity: Number((inventoryQuantity + snapshot.plannedInQuantity - snapshot.plannedOutQuantity).toFixed(2)),
    };
  }

  const warehouseInventoryQuantity = getWarehouseBarcodeInventoryQuantity(data, materialCode);
  const lineSideInventoryQuantity = inventoryLocation
    ? 0
    : getLineSideInventoryQuantity(data, materialCode);
  const inventoryQuantity = Number((warehouseInventoryQuantity + lineSideInventoryQuantity).toFixed(2));
  return {
    ...snapshot,
    inventoryQuantity,
    availableQuantity: Number((inventoryQuantity + snapshot.plannedInQuantity - snapshot.plannedOutQuantity).toFixed(2)),
  };
};

const getInventorySupplyBuckets = (items: InventoryItem[], materialCode: string, cutoffDate?: string): InventorySupplyBucket[] => {
  const immediateQuantity = getInventorySnapshotQuantity(items, materialCode, '即时库存', cutoffDate);
  const plannedIn = items
    .filter((item) => item.materialCode === materialCode && getInventoryKind(item) === '预计入库' && (!cutoffDate || !item.plannedDate || item.plannedDate <= cutoffDate))
    .map((item) => ({ date: item.plannedDate, quantity: item.quantity }));
  const plannedOut = items
    .filter((item) => item.materialCode === materialCode && getInventoryKind(item) === '预计出库' && (!cutoffDate || !item.plannedDate || item.plannedDate <= cutoffDate))
    .map((item) => ({ date: item.plannedDate, quantity: -item.quantity }));

  const bucketsByDate = new Map<string, number>();
  [...plannedIn, ...plannedOut].forEach((item) => {
    const key = item.date ?? '';
    bucketsByDate.set(key, Number(((bucketsByDate.get(key) ?? 0) + item.quantity).toFixed(2)));
  });

  return [
    { quantity: immediateQuantity },
    ...Array.from(bucketsByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, quantity]) => ({ date: date || undefined, quantity })),
  ];
};

const calculateMaterialFulfillmentDate = (
  items: InventoryItem[],
  materialCode: string,
  requiredQuantity: number,
  reservedQuantity: number,
  cutoffDate?: string,
) => {
  let cumulativeQuantity = -reservedQuantity;
  for (const bucket of getInventorySupplyBuckets(items, materialCode, cutoffDate)) {
    cumulativeQuantity = Number((cumulativeQuantity + bucket.quantity).toFixed(2));
    if (cumulativeQuantity >= requiredQuantity) return bucket.date ?? '当前';
  }
  return undefined;
};

const calculateMaterialFulfillmentDateFromData = (
  data: MesStateData,
  materialCode: string,
  requiredQuantity: number,
  reservedQuantity: number,
  cutoffDate?: string,
) => {
  let cumulativeQuantity = -reservedQuantity;
  const immediateQuantity = getAvailableInventoryQuantityFromData(data, materialCode, cutoffDate).inventoryQuantity;
  const [, ...plannedBuckets] = getInventorySupplyBuckets(data.inventory, materialCode, cutoffDate);
  for (const bucket of [{ quantity: immediateQuantity }, ...plannedBuckets]) {
    cumulativeQuantity = Number((cumulativeQuantity + bucket.quantity).toFixed(2));
    if (cumulativeQuantity >= requiredQuantity) return bucket.date ?? '当前';
  }
  return undefined;
};

export const getRequiredInventoryCutoffDate = (deliveryDate: string) => {
  if (!deliveryDate) return undefined;
  const date = new Date(`${deliveryDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

type ShortageAggregationBucket = {
  materialCode: string;
  materialName?: string;
  demandDate: string;
  requiredQuantity: number;
  shortageQuantity: number;
  unit: string;
  salesOrderIds: Set<string>;
  sourceLines: MaterialShortageSourceLine[];
};

const resolveMaterialAttr = (data: MesStateData, materialCode: string): '外购' | '自制' => {
  const material = data.materials.find((item) => item.code === materialCode);
  return material?.materialAttr ?? (material?.type === '原料' || material?.type === '基准料' ? '外购' : '自制');
};

const buildShortageSummaries = (
  buckets: Map<string, ShortageAggregationBucket>,
  data: MesStateData,
  mrpLogId: string,
  mrpRunTime: string,
): MaterialShortageSummary[] => Array.from(buckets.values())
  .map((bucket) => {
    const requiredQuantity = Number(bucket.requiredQuantity.toFixed(2));
    const shortageQuantity = Number(bucket.shortageQuantity.toFixed(2));
    const availableQuantity = Number(Math.max(0, requiredQuantity - shortageQuantity).toFixed(2));
    const materialAttr = resolveMaterialAttr(data, bucket.materialCode);
    return {
      id: `MS-${mrpLogId}-${bucket.materialCode}-${bucket.demandDate}`,
      mrpLogId,
      mrpRunTime,
      materialCode: bucket.materialCode,
      materialName: bucket.materialName ?? data.materials.find((item) => item.code === bucket.materialCode)?.name,
      materialAttr,
      demandDate: bucket.demandDate,
      requiredQuantity,
      availableQuantity,
      shortageQuantity,
      suggestedPurchaseQuantity: materialAttr === '外购' ? shortageQuantity : 0,
      unit: bucket.unit,
      salesOrderIds: [...bucket.salesOrderIds].sort(),
      sourceLines: bucket.sourceLines,
    } satisfies MaterialShortageSummary;
  })
  .filter((item) => item.shortageQuantity > 0)
  .sort((a, b) => a.demandDate.localeCompare(b.demandDate) || a.materialCode.localeCompare(b.materialCode));

const buildSalesOrderRequirementMap = (
  data: MesStateData,
  order: MesStateData['salesOrders'][number],
  reservedByMaterial: Map<string, number>,
  evaluateQuantity = order.quantity,
) => {
  const bomHeader = getStandardBom(data, order.productCode);
  if (!bomHeader) {
    throw new Error(`未找到 ${order.productCode} 的标准物料清单`);
  }

  const materialMap = new Map<string, RequirementBucket>();
  const materialRequirements = expandBomRequirements(data, order.id, order.productCode, bomHeader.code, evaluateQuantity);
  const cutoffDate = getRequiredInventoryCutoffDate(order.deliveryDate);

  materialRequirements.filter((item) => item.kitCheckTarget).forEach((req) => {
    const snapshot = getAvailableInventoryQuantityFromData(data, req.materialCode, cutoffDate);
    const reservedQuantity = reservedByMaterial.get(req.materialCode) ?? 0;
    const effectiveAvailable = Math.max(0, Number((snapshot.availableQuantity - reservedQuantity).toFixed(2)));
    const current = materialMap.get(req.materialCode) ?? {
      requiredQuantity: 0,
      availableQuantity: 0,
      shortageQuantity: 0,
      inventoryQuantity: 0,
      plannedInQuantity: 0,
      plannedOutQuantity: 0,
    };
    current.requiredQuantity += req.requiredQuantity;
    current.availableQuantity = effectiveAvailable;
    current.inventoryQuantity = snapshot.inventoryQuantity;
    current.plannedInQuantity = snapshot.plannedInQuantity;
    current.plannedOutQuantity = snapshot.plannedOutQuantity;
    materialMap.set(req.materialCode, current);
  });

  let producibleQuantity = evaluateQuantity;
  materialMap.forEach((bucket) => {
    const perUnitRequirement = bucket.requiredQuantity / Math.max(1, evaluateQuantity);
    if (perUnitRequirement <= 0) return;
    const nextProducibleQuantity = Math.floor(bucket.availableQuantity / perUnitRequirement);
    producibleQuantity = Math.min(producibleQuantity, nextProducibleQuantity);
  });

  producibleQuantity = Number(Math.max(0, Math.min(evaluateQuantity, producibleQuantity)).toFixed(2));
  const ratio = evaluateQuantity > 0 ? producibleQuantity / evaluateQuantity : 0;
  const fulfillmentDates: string[] = [];

  if (producibleQuantity > 0) {
    materialMap.forEach((bucket, materialCode) => {
      const requiredForProducible = Number((bucket.requiredQuantity * ratio).toFixed(2));
      const reservedQuantity = reservedByMaterial.get(materialCode) ?? 0;
      const fulfillmentDate = calculateMaterialFulfillmentDateFromData(data, materialCode, requiredForProducible, reservedQuantity, cutoffDate);
      if (fulfillmentDate) fulfillmentDates.push(fulfillmentDate);
    });
  }

  const mrpFulfillmentDate = fulfillmentDates.length
    ? fulfillmentDates.includes('当前')
      ? (() => {
        const plannedDates = fulfillmentDates.filter((date) => date !== '当前').sort();
        return plannedDates[plannedDates.length - 1] ?? '当前';
      })()
      : (() => {
        const plannedDates = fulfillmentDates.sort();
        return plannedDates[plannedDates.length - 1];
      })()
    : undefined;

  const shortageLines = Array.from(materialMap.entries())
    .map(([materialCode, bucket]) => {
      const requiredQuantity = Number(bucket.requiredQuantity.toFixed(2));
      const availableQuantity = Number(bucket.availableQuantity.toFixed(2));
      const shortageQuantity = Math.max(0, Number((requiredQuantity - availableQuantity).toFixed(2)));
      return {
        materialCode,
        materialName: data.materials.find((item) => item.code === materialCode)?.name,
        requiredQuantity,
        availableQuantity,
        shortageQuantity,
        unit: 'kg',
      };
    })
    .filter((line) => line.shortageQuantity > 0) satisfies SalesOrderShortageLine[];

  const snapshotByMaterial = new Map<string, RequirementBucket>();
  materialMap.forEach((bucket, materialCode) => {
    const allocatedRequiredQuantity = Number((bucket.requiredQuantity * ratio).toFixed(2));
    snapshotByMaterial.set(materialCode, {
      requiredQuantity: allocatedRequiredQuantity,
      availableQuantity: bucket.availableQuantity,
      shortageQuantity: Math.max(0, Number((allocatedRequiredQuantity - bucket.availableQuantity).toFixed(2))),
      inventoryQuantity: bucket.inventoryQuantity,
      plannedInQuantity: bucket.plannedInQuantity,
      plannedOutQuantity: bucket.plannedOutQuantity,
    });
  });

  return { bomHeader, materialRequirements, pushedQuantity: producibleQuantity, shortageLines, snapshotByMaterial, mrpFulfillmentDate };
};

export interface ProductionOrderSource {
  salesOrderId: string;
  productCode: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  packageRequirement: string;
}

export interface MrpAutoPushLine extends ProductionOrderSource {
  customerCode: string;
  demandSource: DemandSource;
}

export type MrpOrderStatus = {
  producibleQuantity: number;
  autoPushQuantity: number;
  shortageQuantity: number;
  kitReadyStatus: Exclude<KitReadyStatus, '未评估'>;
  shortageLines: SalesOrderShortageLine[];
  productionOrderIds: string[];
  mrpFulfillmentDate?: string;
};

export const defaultMrpAutoPushMergeFields: MrpAutoPushMergeField[] = ['productCode', 'deliveryDate', 'customerCode', 'demandSource', 'unit', 'packageRequirement'];

export const normalizeMrpAutoPushMergeFields = (fields?: MrpAutoPushMergeField[]): MrpAutoPushMergeField[] => {
  const nextFields = fields?.length ? fields : defaultMrpAutoPushMergeFields;
  return nextFields.includes('productCode') ? nextFields : ['productCode', ...nextFields];
};

export const buildMrpAutoPushMergeKey = (
  line: Pick<MrpAutoPushLine, 'productCode' | 'deliveryDate' | 'customerCode' | 'demandSource' | 'unit' | 'packageRequirement'>,
  fields: MrpAutoPushMergeField[] = defaultMrpAutoPushMergeFields,
) => normalizeMrpAutoPushMergeFields(fields).map((field) => line[field]).join('::');

export const buildMrpAutoPushLines = (
  data: MesStateData,
  orderStatusMap: Map<string, MrpOrderStatus>,
  salesOrderIds: string[],
): MrpAutoPushLine[] => salesOrderIds.flatMap((salesOrderId) => {
    if (!data.mrpRule.autoPushEnabled) return [];
    const order = data.salesOrders.find((item) => item.id === salesOrderId);
    const status = orderStatusMap.get(salesOrderId);
    if (!order || order.status !== '已提交' || !status) return [];

    const remainingQuantity = Number((order.remainingQuantity ?? order.quantity).toFixed(2));
    if (remainingQuantity <= 0 || status.autoPushQuantity <= 0) return [];

    const canAutoPushPartial = data.mrpRule.autoPushPartialKitReady ?? true;
    const autoPushQuantity = Number(Math.min(remainingQuantity, status.autoPushQuantity).toFixed(2));
    if (!canAutoPushPartial && autoPushQuantity < remainingQuantity) return [];
    if (autoPushQuantity <= 0) return [];

    return [{
      salesOrderId: order.id,
      productCode: order.productCode,
      quantity: autoPushQuantity,
      unit: order.unit,
      deliveryDate: order.deliveryDate,
      packageRequirement: order.packageRequirement,
      customerCode: order.customerCode,
      demandSource: order.demandSource ?? 'ERP',
    }];
});

export const groupMrpAutoPushLines = (lines: MrpAutoPushLine[], mergeFields: MrpAutoPushMergeField[] = defaultMrpAutoPushMergeFields): ProductionOrderSource[][] => {
  const groups = new Map<string, MrpAutoPushLine[]>();
  const normalizedFields = normalizeMrpAutoPushMergeFields(mergeFields);
  lines.forEach((line) => {
    const key = buildMrpAutoPushMergeKey(line, normalizedFields);
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  });
  return Array.from(groups.values()).map((group) => group.map(({
    salesOrderId,
    productCode,
    quantity,
    unit,
    deliveryDate,
    packageRequirement,
  }) => ({
    salesOrderId,
    productCode,
    quantity,
    unit,
    deliveryDate,
    packageRequirement,
  })));
};

export function createProductionOrderBundle(data: MesStateData, productionOrderId: string, sourceOrders: ProductionOrderSource[]) {
  if (!sourceOrders.length) {
    throw new Error('请选择已提交的销售订单');
  }

  const quantity = Number(sourceOrders.reduce((sum, order) => sum + order.quantity, 0).toFixed(2));
  const productCode = sourceOrders[0].productCode;
  const deliveryDate = [...sourceOrders.map((order) => order.deliveryDate)].sort()[0];
  const bomHeader = getStandardBom(data, productCode);
  if (!bomHeader) {
    throw new Error(`未找到 ${productCode} 的标准物料清单`);
  }

  const materialRequirements = expandBomRequirements(data, productionOrderId, productCode, bomHeader.code, quantity);
  const kitDefaults = buildProductionOrderKitReady(quantity, 0);

  const productionOrder: ProductionOrder = {
    id: productionOrderId,
    batchNo: `PB${nowIso().slice(0, 10).replace(/-/g, '')}-${productionOrderId}`,
    productCode,
    quantity,
    unit: sourceOrders[0].unit,
    salesOrderIds: [...new Set(sourceOrders.map((order) => order.salesOrderId))],
    salesOrderAllocations: sourceOrders.map((order) => ({ salesOrderId: order.salesOrderId, quantity: order.quantity })),
    deliveryDate,
    packageRequirement: sourceOrders[0].packageRequirement,
    ...kitDefaults,
    status: '未排程',
  };

  return { productionOrder, materialRequirements };
}

export function runMrp(data: MesStateData, salesOrderIds: string[]) {
  const selectedOrders = data.salesOrders
    .filter((order) => salesOrderIds.includes(order.id) && order.status === '已提交')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.deliveryDate.localeCompare(b.deliveryDate) || a.id.localeCompare(b.id));

  if (!selectedOrders.length) {
    throw new Error('请选择已提交的销售订单');
  }

  const orderStatusMap = new Map<string, MrpOrderStatus>();
  const shortageBuckets = new Map<string, ShortageAggregationBucket>();
  const reservedByMaterial = getReservedQuantityByMaterial(data);
  const consumedKitBySalesOrder = getConsumedKitReadyBySalesOrder(data.productionOrders);
  const mrpLogId = `MRP${String(data.mrpLogs.length + 1).padStart(3, '0')}`;
  const mrpRunTime = nowIso();

  selectedOrders.forEach((order) => {
    const remainingQuantity = Number((order.remainingQuantity ?? order.quantity).toFixed(2));
    const alreadyConsumedKit = Number((consumedKitBySalesOrder.get(order.id) ?? 0).toFixed(2));

    if (remainingQuantity <= 0) {
      const kitReadyQuantity = alreadyConsumedKit;
      orderStatusMap.set(order.id, {
        producibleQuantity: kitReadyQuantity,
        autoPushQuantity: 0,
        shortageQuantity: Number(Math.max(0, order.quantity - kitReadyQuantity).toFixed(2)),
        kitReadyStatus: deriveKitReadyStatus(kitReadyQuantity, order.quantity),
        shortageLines: [],
        productionOrderIds: order.productionOrderIds ?? [],
        mrpFulfillmentDate: undefined,
      });
      return;
    }

    const plan = buildSalesOrderRequirementMap(data, order, reservedByMaterial, remainingQuantity);
    const producibleForRemaining = plan.pushedQuantity;
    const kitReadyQuantity = Number((alreadyConsumedKit + producibleForRemaining).toFixed(2));
    const shortageQuantity = Number(Math.max(0, order.quantity - kitReadyQuantity).toFixed(2));
    const kitReadyStatus = deriveKitReadyStatus(kitReadyQuantity, order.quantity);
    const autoPushQuantity = producibleForRemaining > 0 ? Number(producibleForRemaining.toFixed(2)) : 0;

    orderStatusMap.set(order.id, {
      producibleQuantity: kitReadyQuantity,
      autoPushQuantity,
      shortageQuantity,
      kitReadyStatus,
      shortageLines: plan.shortageLines,
      productionOrderIds: order.productionOrderIds ?? [],
      mrpFulfillmentDate: plan.mrpFulfillmentDate,
    });

    const demandDate = getRequiredInventoryCutoffDate(order.deliveryDate) ?? order.deliveryDate;
    plan.shortageLines.forEach((line) => {
      const key = `${line.materialCode}::${demandDate}`;
      const current = shortageBuckets.get(key) ?? {
        materialCode: line.materialCode,
        materialName: line.materialName,
        demandDate,
        requiredQuantity: 0,
        shortageQuantity: 0,
        unit: line.unit,
        salesOrderIds: new Set<string>(),
        sourceLines: [],
      };
      current.requiredQuantity += line.requiredQuantity;
      current.shortageQuantity += line.shortageQuantity;
      current.salesOrderIds.add(order.id);
      current.sourceLines.push({
        salesOrderId: order.id,
        productCode: order.productCode,
        deliveryDate: order.deliveryDate,
        requiredQuantity: line.requiredQuantity,
        availableQuantity: line.availableQuantity,
        shortageQuantity: line.shortageQuantity,
      });
      shortageBuckets.set(key, current);
    });

    const reservationRatio = remainingQuantity > 0 ? autoPushQuantity / remainingQuantity : 0;
    plan.materialRequirements
      .filter((item) => item.kitCheckTarget)
      .forEach((req) => {
        const current = reservedByMaterial.get(req.materialCode) ?? 0;
        const reservedRequiredQuantity = Number((req.requiredQuantity * reservationRatio).toFixed(2));
        reservedByMaterial.set(req.materialCode, Number((current + reservedRequiredQuantity).toFixed(2)));
      });
  });

  const log: MrpRunLog = {
    id: mrpLogId,
    runTime: mrpRunTime,
    salesOrderIds: selectedOrders.map((order) => order.id),
    productionOrderIds: data.productionOrders.map((order) => order.id),
    materialReady: selectedOrders.every((order) => (orderStatusMap.get(order.id)?.kitReadyStatus ?? '不齐套') === '齐套'),
    result: '成功',
    remark: 'MRP 运算完成，已计算齐套可自动下推量',
  };
  const shortageSummaries = buildShortageSummaries(shortageBuckets, data, mrpLogId, mrpRunTime);

  return { productionOrders: [], materialRequirements: [], log, selectedOrderIds: selectedOrders.map((order) => order.id), orderStatusMap, shortageSummaries };
}
