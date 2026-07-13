import type { InventoryItem, InventoryKind, InventoryLocation, InventoryReservation, MaterialRequirement, MesStateData, ProductionOrder } from '../models/mes';
import { buildProductionOrderKitReady, getAvailableInventoryQuantityFromData, getLineSideInventoryQuantity } from './mrpService';
import { nowIso } from './helpers';

const replenishableStatuses = ['未排程', '已排程'] as const;
const getInventoryKind = (item: InventoryItem) => item.inventoryKind ?? '即时库存';
export const getInventoryLocation = (item: Pick<InventoryItem, 'inventoryLocation'>) => item.inventoryLocation ?? '仓库';
export const getReservationLocation = (item: Pick<InventoryReservation, 'reservationLocation'>) => item.reservationLocation ?? '仓库';

export const getActiveReservations = (reservations: InventoryReservation[]) =>
  reservations.filter((item) => item.status === '已占用');

export const getPickedQuantity = (reservation: InventoryReservation) => Number((reservation.pickedQuantity ?? 0).toFixed(2));
export const getReturnedQuantity = (reservation: InventoryReservation) => Number((reservation.returnedQuantity ?? 0).toFixed(2));

export const getCurrentReservedQuantity = (reservation: InventoryReservation) =>
  Number(Math.max(0, reservation.reservedQuantity - getPickedQuantity(reservation) - getReturnedQuantity(reservation)).toFixed(2));

export const getReservedQuantityByMaterial = (
  data: MesStateData,
  excludeProductionOrderIds: string[] = [],
  reservationLocation?: InventoryLocation,
) => {
  const exclude = new Set(excludeProductionOrderIds);
  const existingProductionOrderIds = new Set(data.productionOrders.map((item) => item.id));
  const reservedByMaterial = new Map<string, number>();
  getActiveReservations(data.inventoryReservations ?? [])
    .filter((item) => {
      if (reservationLocation && getReservationLocation(item) !== reservationLocation) return false;
      if (item.sourceType !== '生产订单') return true;
      return existingProductionOrderIds.has(item.sourceId) && !exclude.has(item.sourceId);
    })
    .forEach((item) => {
      const current = reservedByMaterial.get(item.materialCode) ?? 0;
      reservedByMaterial.set(item.materialCode, Number((current + getCurrentReservedQuantity(item)).toFixed(2)));
    });
  return reservedByMaterial;
};

export const getMaterialInventorySummary = (data: MesStateData, materialCode: string, inventoryLocation?: InventoryLocation) => {
  const snapshot = getAvailableInventoryQuantityFromData(data, materialCode, undefined, inventoryLocation);
  const reservedQuantity = getReservedQuantityByMaterial(data, [], inventoryLocation).get(materialCode) ?? 0;
  return {
    inventoryQuantity: snapshot.inventoryQuantity,
    reservedQuantity,
    availableQuantity: Number(Math.max(0, snapshot.inventoryQuantity - reservedQuantity).toFixed(2)),
    plannedInQuantity: snapshot.plannedInQuantity,
    plannedOutQuantity: snapshot.plannedOutQuantity,
    mrpAvailableQuantity: Number(Math.max(0, snapshot.availableQuantity - reservedQuantity).toFixed(2)),
  };
};

export const buildReservationsForProductionOrder = (
  data: MesStateData,
  productionOrder: ProductionOrder,
  materialRequirements: MaterialRequirement[],
  existingReservations: InventoryReservation[] = data.inventoryReservations ?? [],
): InventoryReservation[] => {
  const ratio = productionOrder.quantity > 0 ? productionOrder.kitReadyQuantity / productionOrder.quantity : 0;
  const created: InventoryReservation[] = [];
  materialRequirements
    .filter((item) => item.productionOrderId === productionOrder.id && item.kitCheckTarget)
    .forEach((item, index) => {
      const reservedQuantity = Number((item.requiredQuantity * ratio).toFixed(2));
      const lineSideInventoryQuantity = getLineSideInventoryQuantity(data, item.materialCode);
      const lineSideReservedQuantity = getReservedQuantityByMaterial(
        { ...data, inventoryReservations: [...existingReservations, ...created] },
        [],
        '线边仓',
      ).get(item.materialCode) ?? 0;
      const lineSideAvailableQuantity = Number(Math.max(0, lineSideInventoryQuantity - lineSideReservedQuantity).toFixed(2));
      const lineSideQuantity = Number(Math.min(reservedQuantity, lineSideAvailableQuantity).toFixed(2));
      const warehouseQuantity = Number((reservedQuantity - lineSideQuantity).toFixed(2));

      if (lineSideQuantity > 0) {
        created.push({
          id: `RES-LS-${productionOrder.id}-${index + 1}`,
          sourceType: '生产订单' as const,
          sourceId: productionOrder.id,
          materialCode: item.materialCode,
          requiredQuantity: lineSideQuantity,
          reservedQuantity: lineSideQuantity,
          pickedQuantity: 0,
          returnedQuantity: 0,
          reservationLocation: '线边仓',
          shortageQuantity: 0,
          status: '已占用' as const,
          createdAt: nowIso(),
        });
      }

      created.push({
        id: `RES-WH-${productionOrder.id}-${index + 1}`,
        sourceType: '生产订单' as const,
        sourceId: productionOrder.id,
        materialCode: item.materialCode,
        requiredQuantity: Number((item.requiredQuantity - lineSideQuantity).toFixed(2)),
        reservedQuantity: warehouseQuantity,
        pickedQuantity: 0,
        returnedQuantity: 0,
        reservationLocation: '仓库',
        shortageQuantity: Number((item.requiredQuantity - lineSideQuantity - warehouseQuantity).toFixed(2)),
        status: '已占用' as const,
        createdAt: nowIso(),
      });
    });
  return created;
};

export const mergeReservationsForProductionOrders = (
  data: MesStateData,
  reservations: InventoryReservation[],
  productionOrders: ProductionOrder[],
  materialRequirements: MaterialRequirement[],
) => {
  const productionOrderIds = new Set(productionOrders.map((item) => item.id));
  const kept = reservations.filter((item) => !(item.sourceType === '生产订单' && productionOrderIds.has(item.sourceId)));
  const created: InventoryReservation[] = [];
  productionOrders.forEach((productionOrder) => {
    created.push(...buildReservationsForProductionOrder(data, productionOrder, materialRequirements, [...kept, ...created]));
  });
  return [...kept, ...created];
};

export const releaseReservationsForProductionOrder = (
  reservations: InventoryReservation[],
  productionOrderId: string,
) => reservations.filter((item) => !(item.sourceType === '生产订单' && item.sourceId === productionOrderId));

export const getReservationsForProductionOrder = (
  data: MesStateData,
  productionOrderId: string,
) => getActiveReservations(data.inventoryReservations ?? []).filter((item) => item.sourceId === productionOrderId);

const getRequiredInventoryCutoffDate = (deliveryDate: string) => {
  if (!deliveryDate) return undefined;
  const date = new Date(`${deliveryDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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

const getInventorySupplyBuckets = (items: InventoryItem[], materialCode: string, cutoffDate?: string) => {
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
    { date: undefined, quantity: immediateQuantity },
    ...Array.from(bucketsByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, quantity]) => ({ date: date || undefined, quantity })),
  ];
};

const calculateMaterialFulfillmentDate = (
  data: MesStateData,
  materialCode: string,
  requiredQuantity: number,
  reservedQuantity: number,
  cutoffDate?: string,
) => {
  let cumulativeQuantity = -reservedQuantity;
  const immediateQuantity = getAvailableInventoryQuantityFromData(data, materialCode, cutoffDate).inventoryQuantity;
  const [, ...plannedBuckets] = getInventorySupplyBuckets(data.inventory, materialCode, cutoffDate);
  for (const bucket of [{ date: undefined, quantity: immediateQuantity }, ...plannedBuckets]) {
    cumulativeQuantity = Number((cumulativeQuantity + bucket.quantity).toFixed(2));
    if (cumulativeQuantity >= requiredQuantity) return bucket.date ?? '当前';
  }
  return undefined;
};

export const calculateProductionOrderFulfillmentDate = (
  data: MesStateData,
  productionOrder: ProductionOrder,
) => {
  const requirementByMaterial = new Map<string, number>();
  data.materialRequirements
    .filter((item) => item.productionOrderId === productionOrder.id && item.kitCheckTarget)
    .forEach((requirement) => {
      const current = requirementByMaterial.get(requirement.materialCode) ?? 0;
      requirementByMaterial.set(requirement.materialCode, Number((current + requirement.requiredQuantity).toFixed(2)));
    });

  if (!requirementByMaterial.size) return undefined;

  const reservedByMaterial = getReservedQuantityByMaterial(data, [productionOrder.id]);
  const cutoffDate = getRequiredInventoryCutoffDate(productionOrder.deliveryDate);
  const fulfillmentDates: string[] = [];

  for (const [materialCode, requiredQuantity] of requirementByMaterial.entries()) {
    const reservedQuantity = reservedByMaterial.get(materialCode) ?? 0;
    const fulfillmentDate = calculateMaterialFulfillmentDate(data, materialCode, requiredQuantity, reservedQuantity, cutoffDate);
    if (!fulfillmentDate) return undefined;
    fulfillmentDates.push(fulfillmentDate);
  }

  const plannedDates = fulfillmentDates.filter((date) => date !== '当前').sort();
  return plannedDates[plannedDates.length - 1] ?? '当前';
};

export const calculateKitReadyFromAvailableInventory = (
  data: MesStateData,
  productionOrder: Pick<ProductionOrder, 'id' | 'quantity'>,
  materialRequirements: MaterialRequirement[],
) => {
  const reservedByMaterial = getReservedQuantityByMaterial(data);
  const requirementByMaterial = new Map<string, number>();
  materialRequirements
    .filter((item) => item.productionOrderId === productionOrder.id && item.kitCheckTarget)
    .forEach((requirement) => {
      const current = requirementByMaterial.get(requirement.materialCode) ?? 0;
      requirementByMaterial.set(requirement.materialCode, Number((current + requirement.requiredQuantity).toFixed(2)));
    });
  let kitReadyQuantity = productionOrder.quantity;

  requirementByMaterial.forEach((requiredQuantity, materialCode) => {
    const snapshot = getAvailableInventoryQuantityFromData(data, materialCode);
    const reservedQuantity = reservedByMaterial.get(materialCode) ?? 0;
    const availableQuantity = Math.max(0, Number((snapshot.inventoryQuantity - reservedQuantity).toFixed(2)));
    const perUnitRequirement = requiredQuantity / Math.max(1, productionOrder.quantity);
    if (perUnitRequirement <= 0) return;
    kitReadyQuantity = Math.min(kitReadyQuantity, Math.floor(availableQuantity / perUnitRequirement));
  });

  return Number(Math.max(0, kitReadyQuantity).toFixed(2));
};

export const capProductionOrderKitReadyByInventory = (
  data: MesStateData,
  productionOrder: ProductionOrder,
  materialRequirements: MaterialRequirement[],
) => {
  const inventoryKitReady = calculateKitReadyFromAvailableInventory(data, productionOrder, materialRequirements);
  const cappedKitReady = Math.min(productionOrder.kitReadyQuantity, inventoryKitReady);
  return buildProductionOrderKitReady(productionOrder.quantity, cappedKitReady);
};

export const calculateAdditionalKitReady = (
  data: MesStateData,
  productionOrder: ProductionOrder,
  materialRequirements: MaterialRequirement[],
) => {
  const remainingQuantity = Number((productionOrder.quantity - productionOrder.kitReadyQuantity).toFixed(2));
  if (remainingQuantity <= 0) return 0;

  const reservedByMaterial = getReservedQuantityByMaterial(data);
  const requirementByMaterial = new Map<string, number>();
  materialRequirements
    .filter((item) => item.productionOrderId === productionOrder.id && item.kitCheckTarget)
    .forEach((requirement) => {
      const current = requirementByMaterial.get(requirement.materialCode) ?? 0;
      requirementByMaterial.set(requirement.materialCode, Number((current + requirement.requiredQuantity).toFixed(2)));
    });
  let additionalKitReady = remainingQuantity;

  requirementByMaterial.forEach((requiredQuantity, materialCode) => {
    const snapshot = getAvailableInventoryQuantityFromData(data, materialCode);
    const reservedQuantity = reservedByMaterial.get(materialCode) ?? 0;
    const availableQuantity = Math.max(0, Number((snapshot.inventoryQuantity - reservedQuantity).toFixed(2)));
    const perUnitRequirement = requiredQuantity / Math.max(1, productionOrder.quantity);
    if (perUnitRequirement <= 0) return;
    const producibleQuantity = Math.floor(availableQuantity / perUnitRequirement);
    additionalKitReady = Math.min(additionalKitReady, producibleQuantity);
  });

  return Number(Math.max(0, additionalKitReady).toFixed(2));
};

export const previewReplenishProductionOrderKit = (
  data: MesStateData,
  productionOrderId: string,
) => {
  const productionOrder = data.productionOrders.find((item) => item.id === productionOrderId);
  if (!productionOrder) throw new Error('生产订单不存在');
  if (!replenishableStatuses.includes(productionOrder.status as typeof replenishableStatuses[number])) {
    throw new Error('仅未排程或已排程的生产订单支持补齐齐套');
  }
  if (productionOrder.kitReadyQuantity >= productionOrder.quantity) {
    throw new Error('该生产订单已齐套，无需补齐');
  }

  const additionalKitReady = calculateAdditionalKitReady(data, productionOrder, data.materialRequirements);
  const nextKitReadyQuantity = Number((productionOrder.kitReadyQuantity + additionalKitReady).toFixed(2));
  const nextKit = buildProductionOrderKitReady(productionOrder.quantity, nextKitReadyQuantity);

  return {
    productionOrder,
    additionalKitReady,
    nextKitReadyQuantity,
    nextKitReadyStatus: nextKit.kitReadyStatus,
  };
};

export const replenishProductionOrderKit = (data: MesStateData, productionOrderIds: string[]) => {
  if (!productionOrderIds.length) {
    throw new Error('请选择要补齐齐套的生产订单');
  }

  const previews = productionOrderIds.map((productionOrderId) => previewReplenishProductionOrderKit(data, productionOrderId));
  const noGain = previews.every((item) => item.additionalKitReady <= 0);
  if (noGain) {
    throw new Error('当前无可用库存可补齐所选生产订单');
  }

  let nextProductionOrders = [...data.productionOrders];
  let nextReservations = [...(data.inventoryReservations ?? [])];

  previews.forEach((preview) => {
    if (preview.additionalKitReady <= 0) return;
    const nextKit = buildProductionOrderKitReady(preview.productionOrder.quantity, preview.nextKitReadyQuantity);
    const updatedProductionOrder = {
      ...preview.productionOrder,
      ...nextKit,
    };
    nextProductionOrders = nextProductionOrders.map((item) => (item.id === updatedProductionOrder.id ? updatedProductionOrder : item));
    nextReservations = mergeReservationsForProductionOrders(
      { ...data, productionOrders: nextProductionOrders, inventoryReservations: nextReservations },
      nextReservations,
      [updatedProductionOrder],
      data.materialRequirements,
    );
    data = {
      ...data,
      productionOrders: nextProductionOrders,
      inventoryReservations: nextReservations,
    };
  });

  return {
    productionOrders: nextProductionOrders,
    inventoryReservations: nextReservations,
  };
};
