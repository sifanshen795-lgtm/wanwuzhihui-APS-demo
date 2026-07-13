import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BomHeader, BomItem, InventoryItem, Material, MaterialRequirement, MesStateData, MrpRule, ProductionCraft, ProductionForm, ProductionProcess, ProductionOrder, SalesOrderShortageLine, ScheduleItem, ScheduleRule } from '../domain/models/mes';
import { capProductionOrderKitReadyByInventory, getCurrentReservedQuantity, getReservationLocation, mergeReservationsForProductionOrders, releaseReservationsForProductionOrder, replenishProductionOrderKit as applyReplenishProductionOrderKit } from '../domain/services/inventoryReservationService';
import { attachKitReadyToProductionOrder, buildMrpAutoPushLines, createProductionOrderBundle, defaultMrpAutoPushMergeFields, getAvailableInventoryQuantityFromData, groupMrpAutoPushLines, runMrp, type MrpOrderStatus, type ProductionOrderSource } from '../domain/services/mrpService';
import {
  clearProductionOrderSchedulePlan,
  createProductionOrderSchedulePlan,
  createProductionOrderSchedulePlans,
  createScheduleItemsFromProductionOrders,
  normalizeProductionOrderStatus,
  normalizeScheduleItem,
  recallScheduleOutput as applyRecallScheduleOutput,
  recallSchedulePushdown as applyRecallSchedulePushdown,
  syncScheduleItemStatuses,
  updateProductionOrderSchedulePlan,
  updateProductionOrderScheduleWindow,
  type ProductionOrderSchedulePlanPayload,
} from '../domain/services/scheduleService';
import { generateBatchWorkOrders } from '../domain/services/workOrderService';
import { generateFormulaSheets } from '../domain/services/formulaService';
import { feedByBarcode, feedFromTank, makeExecutionRecord, packageWorkOrder, transferToTank } from '../domain/services/executionService';
import { nowIso } from '../domain/services/helpers';
import { createSeedData } from '../mock/seedData';

type ValidationBaseline = Pick<MesStateData,
  | 'materials'
  | 'colorGrades'
  | 'customers'
  | 'units'
  | 'workshops'
  | 'lines'
  | 'lineProductRelations'
  | 'productIntermediateRelations'
  | 'productGroupRelations'
  | 'productionCalendars'
  | 'bomHeaders'
  | 'bomItems'
  | 'productionForms'
  | 'productionProcesses'
  | 'productionCrafts'
  | 'mrpRule'
  | 'scheduleRules'
  | 'salesOrders'
  | 'inventory'
  | 'tanks'
> & {
  savedAt: string;
};

interface MesStore extends MesStateData {
  validationBaseline?: ValidationBaseline | null;
  resetDemo: () => void;
  saveValidationBaselineAction: () => void;
  restoreValidationBaselineAction: () => void;
  rollbackToPreMrpAction: () => void;
  createColorGradeAction: (colorGrade: MesStateData['colorGrades'][number]) => void;
  editColorGradeAction: (previousCode: string, colorGrade: MesStateData['colorGrades'][number]) => void;
  deleteColorGradeAction: (colorGradeCode: string) => void;
  createCustomerAction: (customer: MesStateData['customers'][number]) => void;
  editCustomerAction: (previousCode: string, customer: MesStateData['customers'][number]) => void;
  deleteCustomerAction: (customerCode: string) => void;
  createUnitAction: (unit: MesStateData['units'][number]) => void;
  editUnitAction: (previousCode: string, unit: MesStateData['units'][number]) => void;
  deleteUnitAction: (unitCode: string) => void;
  batchDeleteUnitAction: (unitCodes: string[]) => void;
  createWorkshopAction: (workshop: MesStateData['workshops'][number]) => void;
  editWorkshopAction: (previousCode: string, workshop: MesStateData['workshops'][number]) => void;
  deleteWorkshopAction: (workshopCode: string) => void;
  batchDeleteWorkshopAction: (workshopCodes: string[]) => void;
  createLineAction: (line: MesStateData['lines'][number]) => void;
  editLineAction: (previousCode: string, line: MesStateData['lines'][number]) => void;
  deleteLineAction: (lineCode: string) => void;
  batchDeleteLineAction: (lineCodes: string[]) => void;
  createLineProductRelationAction: (relation: MesStateData['lineProductRelations'][number]) => void;
  editLineProductRelationAction: (previousKey: { productCode: string; lineCode: string }, relation: MesStateData['lineProductRelations'][number]) => void;
  deleteLineProductRelationAction: (key: { productCode: string; lineCode: string }) => void;
  batchDeleteLineProductRelationAction: (keys: Array<{ productCode: string; lineCode: string }>) => void;
  createProductGroupRelationAction: (relation: MesStateData['productGroupRelations'][number]) => void;
  editProductGroupRelationAction: (previousCode: string, relation: MesStateData['productGroupRelations'][number]) => void;
  deleteProductGroupRelationAction: (code: string) => void;
  batchDeleteProductGroupRelationAction: (codes: string[]) => void;
  createProductionCalendarAction: (calendar: MesStateData['productionCalendars'][number]) => void;
  editProductionCalendarAction: (previousCode: string, calendar: MesStateData['productionCalendars'][number]) => void;
  deleteProductionCalendarAction: (calendarCode: string) => void;
  batchDeleteProductionCalendarAction: (calendarCodes: string[]) => void;
  createMaterialAction: (material: Material) => void;
  editMaterialAction: (previousCode: string, material: Material) => void;
  deleteMaterialAction: (materialCode: string) => void;
  toggleMaterialEnabledAction: (materialCode: string) => void;
  createInventoryAction: (item: InventoryItem) => void;
  editInventoryAction: (previousId: string, item: InventoryItem) => void;
  deleteInventoryAction: (id: string) => void;
  createBomHeaderAction: (header: BomHeader, items: BomItem[]) => void;
  updateBomHeaderAction: (previousCode: string, header: BomHeader, items: BomItem[]) => void;
  deleteBomHeadersAction: (headerCodes: string[]) => void;
  createProductionFormAction: (form: ProductionForm) => void;
  editProductionFormAction: (previousCode: string, form: ProductionForm) => void;
  deleteProductionFormsAction: (codes: string[]) => void;
  updateProductionFormDesignAction: (code: string, fields: ProductionForm['fields']) => void;
  createProductionProcessAction: (process: ProductionProcess) => void;
  editProductionProcessAction: (previousCode: string, process: ProductionProcess) => void;
  deleteProductionProcessesAction: (codes: string[]) => void;
  createProductionCraftAction: (craft: ProductionCraft) => void;
  editProductionCraftAction: (previousCode: string, craft: ProductionCraft) => void;
  deleteProductionCraftsAction: (codes: string[]) => void;
  updateProductionCraftConfigAction: (code: string, payload: Pick<ProductionCraft, 'nodes' | 'edges'>) => void;
  createSalesOrderAction: () => void;
  addSalesOrderAction: (salesOrder: MesStateData['salesOrders'][number]) => void;
  editSalesOrderAction: (previousId: string, salesOrder: MesStateData['salesOrders'][number]) => void;
  deleteSalesOrderAction: (salesOrderId: string) => void;
  reorderSalesOrdersAction: (orderedIds: string[]) => void;
  splitSalesOrderAction: (salesOrderId: string, splitOrders: Array<{ quantity: number; deliveryDate: string }>) => void;
  mergeSalesOrdersAction: (salesOrderIds: string[], mergedOrder: { id: string; quantity: number; deliveryDate: string; customerCode: string; productCode: string; unit: string; packageRequirement: string }) => void;
  closeSalesOrderAction: (salesOrderId: string) => void;
  pushSalesOrdersToProductionOrdersAction: (salesOrderIds: string[]) => void;
  pushProductionOrderToScheduleAction: (productionOrderId: string) => void;
  pushProductionOrdersToScheduleAction: (productionOrderIds: string[]) => void;
  recallProductionOrderScheduleAction: (productionOrderId: string) => void;
  updateProductionOrderSchedulePlanAction: (productionOrderId: string, payload: ProductionOrderSchedulePlanPayload) => void;
  updateProductionOrderScheduleWindowAction: (productionOrderId: string, payload: { lineCode: string; startAt: string; endAt: string }) => void;
  outputProductionOrdersToScheduleAction: (productionOrderIds: string[]) => void;
  recallScheduleOutputAction: (scheduleItemIds: string[]) => void;
  deleteProductionOrderAction: (productionOrderId: string) => void;
  replenishProductionOrderKitAction: (productionOrderIds: string[]) => void;
  updateMaterialRequirementAction: (requirementId: string, requirement: MaterialRequirement) => void;
  updateScheduleRulesAction: (rules: ScheduleRule[]) => void;
  resetScheduleRulesAction: () => void;
  updateMrpRuleAction: (rule: MrpRule) => void;
  runMrpForOrders: () => void;
  pushDownSchedule: (scheduleItemIds?: string[]) => void;
  recallSchedulePushdown: (scheduleItemIds: string[]) => void;
  pruneInvalidChildBatchWorkOrdersAction: () => void;
  pickInventoryReservationAction: (reservationId: string, quantity: number) => void;
  returnInventoryReservationAction: (reservationId: string, quantity: number) => void;
  pickProductionOrderByBarcodeAction: (productionOrderId: string, barcodeCode: string) => void;
  returnProductionOrderByBarcodeAction: (productionOrderId: string, barcodeCode: string) => void;
  updateFormulaLineBatchesAction: (formulaId: string, lineId: string, batches: Array<{ batchNo: string }>) => void;
  approveFormulaAction: (formulaId: string) => void;
  approveAllFormulas: () => void;
  startBatchWorkOrderAction: (batchWorkOrderId: string) => void;
  pauseBatchWorkOrderAction: (batchWorkOrderId: string) => void;
  completeBatchWorkOrderAction: (batchWorkOrderId: string) => void;
  feedByBarcodeAction: (batchWorkOrderId: string, barcodeCode: string, actualQuantity: number, feedPort?: string, remainingQuantity?: number) => void;
  feedFromTankAction: (batchWorkOrderId: string, tankCode: string, before: number, after: number) => void;
  packageWorkOrderAction: (batchWorkOrderId: string, weight: number) => void;
  deletePackageBarcodeAction: (barcodeCode: string) => void;
  transferToTankAction: (barcodeCode: string, tankCode: string, quantity: number) => void;
}

const seed = createSeedData();
const defaultScheduleRules = seed.scheduleRules;
const singleEnabledLineStages = ['配色', '配料'];
const assertSingleEnabledLineForStage = (lines: MesStateData['lines'], line: MesStateData['lines'][number], previousCode?: string) => {
  if (!line.enabled || !singleEnabledLineStages.includes(line.stage)) return;
  const existingLine = lines.find((item) => item.enabled && item.stage === line.stage && item.code !== previousCode && item.code !== line.code);
  if (existingLine) {
    throw new Error(`${line.stage}暂时只允许启用一条产线，当前已启用：${existingLine.name}`);
  }
};
const normalizeScheduleRules = (rules?: ScheduleRule[]) => {
  if (!rules?.length) return defaultScheduleRules;
  const existingByCode = new Map(rules.map((rule) => [rule.code, rule]));
  return defaultScheduleRules.map((rule) => ({ ...rule, ...existingByCode.get(rule.code) })).sort((a, b) => a.priority - b.priority);
};
const normalizeMrpRule = (rule?: Partial<MrpRule>): MrpRule => ({
  mergeSameMaterialDifferentCustomer: rule?.mergeSameMaterialDifferentCustomer ?? seed.mrpRule.mergeSameMaterialDifferentCustomer,
  deliveryWindowDays: rule?.deliveryWindowDays ?? seed.mrpRule.deliveryWindowDays,
  autoPushEnabled: rule?.autoPushEnabled ?? true,
  autoPushPartialKitReady: rule?.autoPushPartialKitReady ?? true,
  autoPushMergeFields: rule?.autoPushMergeFields?.length ? rule.autoPushMergeFields : defaultMrpAutoPushMergeFields,
});

const createSalesOrderId = (salesOrders: MesStateData['salesOrders']) => `SO${String(salesOrders.length + 1).padStart(3, '0')}`;

const normalizeSalesOrderSortOrders = (salesOrders: MesStateData['salesOrders']) =>
  salesOrders.map((order, index) => ({ ...order, sortOrder: index + 1 }));

const sortSalesOrdersByManualOrder = (salesOrders: MesStateData['salesOrders']) =>
  [...salesOrders].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.deliveryDate.localeCompare(b.deliveryDate) || a.id.localeCompare(b.id));

const insertSalesOrderByDeliveryDate = (
  salesOrders: MesStateData['salesOrders'],
  salesOrder: MesStateData['salesOrders'][number],
) => {
  const ordered = sortSalesOrdersByManualOrder(salesOrders.filter((order) => order.id !== salesOrder.id));
  const insertIndex = ordered.findIndex((order) => order.deliveryDate > salesOrder.deliveryDate);
  const nextOrders = [...ordered];
  nextOrders.splice(insertIndex === -1 ? nextOrders.length : insertIndex, 0, salesOrder);
  return normalizeSalesOrderSortOrders(nextOrders);
};

const syncScheduleItemsAfterBatchChange = (
  data: MesStateData,
  batchWorkOrders: MesStateData['batchWorkOrders'],
): MesStateData['scheduleItems'] => syncScheduleItemStatuses(data.scheduleItems, batchWorkOrders);

const persistedArrayOrCurrent = <T>(value: T[] | undefined, fallback: T[]) => (Array.isArray(value) ? value : fallback);

const pruneInvalidChildBatchArtifacts = (
  materials: Material[],
  materialRequirements: MaterialRequirement[],
  productionOrders: MesStateData['productionOrders'],
  batchWorkOrders: MesStateData['batchWorkOrders'],
  formulaSheets: MesStateData['formulaSheets'],
) => {
  const materialAttrByCode = new Map(materials.map((material) => [material.code, material.materialAttr]));
  const productionOrderById = new Map(productionOrders.map((order) => [order.id, order]));
  const validSelfMadeRequirementKeys = new Set(
    materialRequirements
      .filter((requirement) => {
        const productionOrder = productionOrderById.get(requirement.productionOrderId);
        if (!productionOrder) return false;
        return requirement.materialAttr === '自制'
          && materialAttrByCode.get(requirement.materialCode) !== '外购';
      })
      .map((requirement) => `${requirement.productionOrderId}::${requirement.materialCode}`),
  );
  const invalidChildWorkOrderIds = new Set(
    batchWorkOrders
      .filter((workOrder) => workOrder.parentBatchWorkOrderId)
      .filter((workOrder) => !validSelfMadeRequirementKeys.has(`${workOrder.productionOrderId}::${workOrder.materialCode}`))
      .map((workOrder) => workOrder.id),
  );

  if (!invalidChildWorkOrderIds.size) {
    return { batchWorkOrders, formulaSheets };
  }

  return {
    batchWorkOrders: batchWorkOrders.filter((workOrder) => !invalidChildWorkOrderIds.has(workOrder.id)),
    formulaSheets: formulaSheets.filter((formula) => !invalidChildWorkOrderIds.has(formula.batchWorkOrderId)),
  };
};

const aggregateProductionOrderAllocations = (
  productionOrders: MesStateData['productionOrders'],
) => {
  const allocationMap = new Map<string, { productionOrderIds: Set<string>; pushedQuantity: number }>();
  productionOrders.forEach((productionOrder) => {
    productionOrder.salesOrderAllocations.forEach((allocation) => {
      const current = allocationMap.get(allocation.salesOrderId) ?? {
        productionOrderIds: new Set<string>(),
        pushedQuantity: 0,
      };
      current.productionOrderIds.add(productionOrder.id);
      current.pushedQuantity += allocation.quantity;
      allocationMap.set(allocation.salesOrderId, current);
    });
  });
  return allocationMap;
};

const aggregateShortageLines = (
  data: MesStateData,
  productionOrders: MesStateData['productionOrders'],
  materialRequirements: MaterialRequirement[],
) => {
  const shortageMap = new Map<string, SalesOrderShortageLine[]>();
  const grouped = new Map<string, { productionOrderId: string; materialCode: string; requiredQuantity: number; materialAttr: '外购' | '自制'; unit: string; rootProductCode: string }>();

  materialRequirements
    .filter((item) => item.kitCheckTarget)
    .forEach((req) => {
      const key = `${req.productionOrderId}::${req.materialCode}`;
      const current = grouped.get(key) ?? {
        productionOrderId: req.productionOrderId,
        materialCode: req.materialCode,
        requiredQuantity: 0,
        materialAttr: req.materialAttr,
        unit: req.unit,
        rootProductCode: req.rootProductCode,
      };
      current.requiredQuantity += req.requiredQuantity;
      grouped.set(key, current);
    });

  grouped.forEach((group) => {
    const productionOrder = productionOrders.find((order) => order.id === group.productionOrderId);
    const { materialCode } = group;
    const productionOrderId = group.productionOrderId;
    if (!productionOrder) return;
    const availableQuantity = getAvailableInventoryQuantityFromData(data, materialCode).availableQuantity;
    const shortageQuantity = Math.max(0, Number((group.requiredQuantity - availableQuantity).toFixed(2)));
    if (shortageQuantity <= 0) return;
    productionOrder.salesOrderAllocations.forEach((allocation) => {
      const share = allocation.quantity / productionOrder.quantity;
      const current = shortageMap.get(allocation.salesOrderId) ?? [];
      shortageMap.set(allocation.salesOrderId, [...current, {
        materialCode,
        materialName: data.materials.find((item) => item.code === materialCode)?.name,
        requiredQuantity: Number((group.requiredQuantity * share).toFixed(2)),
        availableQuantity: Number((availableQuantity * share).toFixed(2)),
        shortageQuantity: Number((shortageQuantity * share).toFixed(2)),
        unit: group.unit,
      }]);
    });
  });
  return shortageMap;
};

const syncSalesOrdersAfterProductionOrderChanges = (
  data: MesStateData,
  productionOrders: MesStateData['productionOrders'],
  shortageMap = new Map<string, SalesOrderShortageLine[]>(),
) => {
  const allocations = aggregateProductionOrderAllocations(productionOrders);
  return data.salesOrders.map((item) => {
    const allocation = allocations.get(item.id);
    const pushedQuantity = Number((allocation?.pushedQuantity ?? 0).toFixed(2));
    const remainingQuantity = Number(Math.max(0, (item.quantity ?? 0) - pushedQuantity).toFixed(2));
    return {
      ...item,
      pushedQuantity,
      remainingQuantity,
      productionOrderIds: allocation ? [...allocation.productionOrderIds] : [],
      shortageLines: shortageMap.get(item.id) ?? item.shortageLines,
    };
  });
};

const buildProductionOrderFromSources = (
  data: MesStateData,
  productionOrderId: string,
  sourceOrders: ProductionOrderSource[],
  existingProductionOrders: MesStateData['productionOrders'],
  priorNewOrders: MesStateData['productionOrders'],
) => {
  const bundle = createProductionOrderBundle(data, productionOrderId, sourceOrders);
  const withKit = attachKitReadyToProductionOrder(bundle.productionOrder, data.salesOrders, existingProductionOrders, priorNewOrders);
  const kitFields = capProductionOrderKitReadyByInventory(data, withKit, bundle.materialRequirements);
  return {
    productionOrder: { ...withKit, ...kitFields, status: '未排程' as const },
    materialRequirements: bundle.materialRequirements,
  };
};

const applyMrpAutoPush = (
  data: MesStateData,
  orderStatusMap: Map<string, MrpOrderStatus>,
  salesOrderIds: string[],
) => {
  const autoPushLines = buildMrpAutoPushLines(data, orderStatusMap, salesOrderIds);
  const sourceGroups = groupMrpAutoPushLines(autoPushLines, data.mrpRule.autoPushMergeFields);
  const priorNewOrders: MesStateData['productionOrders'] = [];
  const newProductionOrderIds: string[] = [];
  let nextReservations = data.inventoryReservations ?? [];
  let nextProductionOrders = [...data.productionOrders];
  let nextMaterialRequirements = [...data.materialRequirements];

  sourceGroups.forEach((sources) => {
    const nextIndex = data.productionOrders.length + priorNewOrders.length + 1;
    const productionOrderId = `MO${String(nextIndex).padStart(3, '0')}`;
    const bundle = buildProductionOrderFromSources(
      { ...data, productionOrders: nextProductionOrders, materialRequirements: nextMaterialRequirements, inventoryReservations: nextReservations },
      productionOrderId,
      sources,
      data.productionOrders,
      priorNewOrders,
    );
    priorNewOrders.push(bundle.productionOrder);
    nextProductionOrders.push(bundle.productionOrder);
    nextMaterialRequirements.push(...bundle.materialRequirements);
    nextReservations = mergeReservationsForProductionOrders(
      { ...data, productionOrders: nextProductionOrders, materialRequirements: nextMaterialRequirements, inventoryReservations: nextReservations },
      nextReservations,
      [bundle.productionOrder],
      bundle.materialRequirements,
    );
    newProductionOrderIds.push(productionOrderId);
  });

  return {
    newProductionOrderIds,
    productionOrders: nextProductionOrders,
    materialRequirements: nextMaterialRequirements,
    scheduleItems: data.scheduleItems,
    inventoryReservations: nextReservations,
  };
};

const normalizeInventoryItem = (item: InventoryItem): InventoryItem => ({
  ...item,
  inventoryKind: item.inventoryKind ?? '即时库存',
  inventoryLocation: item.inventoryLocation ?? '仓库',
});

const normalizeInventoryItems = (inventory: InventoryItem[]) => inventory.map(normalizeInventoryItem);
const normalizeInventoryReservations = (reservations: MesStateData['inventoryReservations']) => reservations.map((reservation) => ({
  ...reservation,
  pickedQuantity: reservation.pickedQuantity ?? 0,
  returnedQuantity: reservation.returnedQuantity ?? 0,
  reservationLocation: reservation.reservationLocation ?? '仓库',
}));

const consumeLineSideReservations = (
  reservations: MesStateData['inventoryReservations'],
  productionOrderId: string,
  materialCode: string,
  quantity: number,
) => {
  let remainingQuantity = Number(quantity.toFixed(2));
  return reservations.map((reservation) => {
    if (
      remainingQuantity <= 0
      || reservation.sourceId !== productionOrderId
      || reservation.materialCode !== materialCode
      || (reservation.reservationLocation ?? '仓库') !== '线边仓'
      || reservation.status !== '已占用'
    ) {
      return reservation;
    }
    const currentReservedQuantity = getCurrentReservedQuantity(reservation);
    const consumedQuantity = Math.min(currentReservedQuantity, remainingQuantity);
    remainingQuantity = Number((remainingQuantity - consumedQuantity).toFixed(2));
    return {
      ...reservation,
      pickedQuantity: Number(((reservation.pickedQuantity ?? 0) + consumedQuantity).toFixed(2)),
      updatedAt: nowIso(),
    };
  });
};
const normalizeBarcodes = (barcodes: MesStateData['barcodes']) => barcodes.map((barcode) => ({
  ...barcode,
  inventoryStatus: barcode.inventoryStatus ?? '库内',
}));
const normalizeTanks = (tanks: MesStateData['tanks']) => tanks.map((tank) => ({
  ...tank,
  inventoryStatus: '库外' as const,
}));
const normalizeMaterial = (material: Material): Material => ({
  ...material,
  materialAttr: material.materialAttr ?? (material.type === '原料' || material.type === '基准料' ? '外购' : '自制'),
});
const normalizeMaterials = (materials: Material[]) => materials.map(normalizeMaterial);
const normalizeProductionProcess = (process: ProductionProcess): ProductionProcess => ({
  ...process,
  processAttr: process.processAttr ?? '通用',
});
const normalizeProductionProcesses = (processes: ProductionProcess[]) => processes.map(normalizeProductionProcess);
const normalizeProductionCrafts = (crafts: ProductionCraft[]) => crafts.map((craft) => ({
  ...craft,
  materialCode: craft.materialCode ?? 'PROD-A',
  nodes: craft.nodes.map((node) => ({
    ...node,
    materials: node.materials.map((material) => ({
      id: material.id,
      materialCode: material.materialCode,
      remark: material.remark,
    })),
  })),
}));
const cloneData = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeBaselineSalesOrders = (salesOrders: MesStateData['salesOrders']) => normalizeSalesOrderSortOrders(sortSalesOrdersByManualOrder(salesOrders.map((order) => ({
  ...order,
  demandSource: order.demandSource ?? 'ERP',
  pushedQuantity: 0,
  remainingQuantity: order.quantity,
  productionOrderIds: [],
  kitReadyStatus: '未评估' as const,
  mrpFulfillmentDate: undefined,
  shortageLines: [],
}))));

const createValidationBaseline = (data: MesStateData): ValidationBaseline => ({
  savedAt: nowIso(),
  materials: cloneData(data.materials),
  colorGrades: cloneData(data.colorGrades),
  customers: cloneData(data.customers),
  units: cloneData(data.units),
  workshops: cloneData(data.workshops),
  lines: cloneData(data.lines),
  lineProductRelations: cloneData(data.lineProductRelations),
  productIntermediateRelations: cloneData(data.productIntermediateRelations),
  productGroupRelations: cloneData(data.productGroupRelations),
  productionCalendars: cloneData(data.productionCalendars),
  bomHeaders: cloneData(data.bomHeaders),
  bomItems: cloneData(data.bomItems),
  productionForms: cloneData(data.productionForms),
  productionProcesses: normalizeProductionProcesses(cloneData(data.productionProcesses)),
  productionCrafts: normalizeProductionCrafts(cloneData(data.productionCrafts)),
  mrpRule: cloneData(data.mrpRule),
  scheduleRules: cloneData(data.scheduleRules),
  salesOrders: cloneData(data.salesOrders),
  inventory: cloneData(data.inventory),
  tanks: normalizeTanks(cloneData(data.tanks)),
});

const restoreValidationBaseline = (baseline: ValidationBaseline) => ({
  materials: normalizeMaterials(cloneData(baseline.materials)),
  colorGrades: cloneData(baseline.colorGrades),
  customers: cloneData(baseline.customers),
  units: cloneData(baseline.units),
  workshops: cloneData(baseline.workshops),
  lines: cloneData(baseline.lines),
  lineProductRelations: cloneData(baseline.lineProductRelations),
  productIntermediateRelations: cloneData(baseline.productIntermediateRelations),
  productGroupRelations: cloneData(baseline.productGroupRelations),
  productionCalendars: cloneData(baseline.productionCalendars),
  bomHeaders: cloneData(baseline.bomHeaders),
  bomItems: cloneData(baseline.bomItems),
  productionForms: cloneData(baseline.productionForms),
  productionProcesses: normalizeProductionProcesses(cloneData(baseline.productionProcesses)),
  productionCrafts: normalizeProductionCrafts(cloneData(baseline.productionCrafts)),
  mrpRule: normalizeMrpRule(baseline.mrpRule),
  scheduleRules: normalizeScheduleRules(baseline.scheduleRules),
  salesOrders: normalizeBaselineSalesOrders(cloneData(baseline.salesOrders)),
  inventory: normalizeInventoryItems(cloneData(baseline.inventory)),
  tanks: normalizeTanks(cloneData(baseline.tanks)),
  mrpLogs: [],
  productionOrders: [],
  materialRequirements: [],
  scheduleItems: [],
  batchWorkOrders: [],
  formulaSheets: [],
  inventoryReservations: [],
  materialShortages: [],
  executionRecords: [],
  feedRecords: [],
  packageRecords: [],
  transferRecords: [],
  lossRecords: [],
});

export const useMesStore = create<MesStore>()(
  persist(
    (set, get) => ({
      ...seed,
      validationBaseline: null,
      materials: normalizeMaterials(seed.materials),
      mrpRule: normalizeMrpRule(seed.mrpRule),
      scheduleRules: normalizeScheduleRules(seed.scheduleRules),
      inventory: normalizeInventoryItems(seed.inventory),
      barcodes: normalizeBarcodes(seed.barcodes),
      tanks: normalizeTanks(seed.tanks),
      resetDemo: () => {
        const nextSeed = createSeedData();
        set({ ...nextSeed, validationBaseline: get().validationBaseline ?? null, mrpRule: normalizeMrpRule(nextSeed.mrpRule), scheduleRules: normalizeScheduleRules(nextSeed.scheduleRules), inventory: normalizeInventoryItems(nextSeed.inventory), barcodes: normalizeBarcodes(nextSeed.barcodes), tanks: normalizeTanks(nextSeed.tanks) });
      },
      saveValidationBaselineAction: () => {
        set({ validationBaseline: createValidationBaseline(get()) });
      },
      restoreValidationBaselineAction: () => {
        const baseline = get().validationBaseline;
        if (!baseline) throw new Error('尚未保存验证基线');
        set({ ...restoreValidationBaseline(baseline), validationBaseline: baseline });
      },
      rollbackToPreMrpAction: () => {
        const data = get();
        set({
          salesOrders: data.salesOrders.map((order, index) => ({
            ...order,
            status: '已提交',
            sortOrder: order.sortOrder ?? index + 1,
            pushedQuantity: 0,
            remainingQuantity: order.quantity,
            productionOrderIds: [],
            kitReadyStatus: '未评估',
            kitReadyQuantity: 0,
            mrpFulfillmentDate: undefined,
            shortageLines: [],
          })),
          mrpLogs: [],
          productionOrders: [],
          materialRequirements: [],
          scheduleItems: [],
          batchWorkOrders: [],
          formulaSheets: [],
          inventoryReservations: [],
          materialShortages: [],
          executionRecords: [],
          feedRecords: [],
          packageRecords: [],
          transferRecords: [],
          lossRecords: [],
        });
      },
      createColorGradeAction: (colorGrade) => {
        const data = get();
        set({
          colorGrades: [...data.colorGrades.filter((item) => item.code !== colorGrade.code), colorGrade].sort((a, b) => a.sort - b.sort),
        });
      },
      editColorGradeAction: (previousCode, colorGrade) => {
        const data = get();
        set({
          colorGrades: [...data.colorGrades.filter((item) => item.code !== previousCode && item.code !== colorGrade.code), colorGrade].sort((a, b) => a.sort - b.sort),
        });
      },
      deleteColorGradeAction: (colorGradeCode) => {
        const data = get();
        set({ colorGrades: data.colorGrades.filter((item) => item.code !== colorGradeCode) });
      },
      createCustomerAction: (customer) => {
        const data = get();
        set({ customers: [...data.customers.filter((item) => item.code !== customer.code), customer] });
      },
      editCustomerAction: (previousCode, customer) => {
        const data = get();
        set({ customers: [...data.customers.filter((item) => item.code !== previousCode && item.code !== customer.code), customer] });
      },
      deleteCustomerAction: (customerCode) => {
        const data = get();
        set({ customers: data.customers.filter((item) => item.code !== customerCode) });
      },
      createUnitAction: (unit) => {
        const data = get();
        set({ units: [...data.units.filter((item) => item.code !== unit.code), unit] });
      },
      editUnitAction: (previousCode, unit) => {
        const data = get();
        set({ units: [...data.units.filter((item) => item.code !== previousCode && item.code !== unit.code), unit] });
      },
      deleteUnitAction: (unitCode) => {
        const data = get();
        set({ units: data.units.filter((item) => item.code !== unitCode) });
      },
      batchDeleteUnitAction: (unitCodes) => {
        const data = get();
        set({ units: data.units.filter((item) => !unitCodes.includes(item.code)) });
      },
      createWorkshopAction: (workshop) => {
        const data = get();
        set({ workshops: [...data.workshops.filter((item) => item.code !== workshop.code), workshop] });
      },
      editWorkshopAction: (previousCode, workshop) => {
        const data = get();
        set({ workshops: [...data.workshops.filter((item) => item.code !== previousCode && item.code !== workshop.code), workshop] });
      },
      deleteWorkshopAction: (workshopCode) => {
        const data = get();
        set({ workshops: data.workshops.filter((item) => item.code !== workshopCode) });
      },
      batchDeleteWorkshopAction: (workshopCodes) => {
        const data = get();
        set({ workshops: data.workshops.filter((item) => !workshopCodes.includes(item.code)) });
      },
      createLineAction: (line) => {
        const data = get();
        assertSingleEnabledLineForStage(data.lines, line);
        set({ lines: [...data.lines.filter((item) => item.code !== line.code), line] });
      },
      editLineAction: (previousCode, line) => {
        const data = get();
        assertSingleEnabledLineForStage(data.lines, line, previousCode);
        set({ lines: [...data.lines.filter((item) => item.code !== previousCode && item.code !== line.code), line] });
      },
      deleteLineAction: (lineCode) => {
        const data = get();
        set({ lines: data.lines.filter((item) => item.code !== lineCode) });
      },
      batchDeleteLineAction: (lineCodes) => {
        const data = get();
        set({ lines: data.lines.filter((item) => !lineCodes.includes(item.code)) });
      },
      createLineProductRelationAction: (relation) => {
        const data = get();
        set({
          lineProductRelations: [...data.lineProductRelations.filter((item) => !(item.productCode === relation.productCode && item.lineCode === relation.lineCode)), relation],
        });
      },
      editLineProductRelationAction: (previousKey, relation) => {
        const data = get();
        set({
          lineProductRelations: [...data.lineProductRelations.filter((item) => !(item.productCode === previousKey.productCode && item.lineCode === previousKey.lineCode) && !(item.productCode === relation.productCode && item.lineCode === relation.lineCode)), relation],
        });
      },
      deleteLineProductRelationAction: (key) => {
        const data = get();
        set({ lineProductRelations: data.lineProductRelations.filter((item) => !(item.productCode === key.productCode && item.lineCode === key.lineCode)) });
      },
      batchDeleteLineProductRelationAction: (keys) => {
        const data = get();
        set({ lineProductRelations: data.lineProductRelations.filter((item) => !keys.some((key) => key.productCode === item.productCode && key.lineCode === item.lineCode)) });
      },
      createProductGroupRelationAction: (relation) => {
        const data = get();
        const productGroupRelations = data.productGroupRelations ?? [];
        set({ productGroupRelations: [...productGroupRelations.filter((item) => item.code !== relation.code), relation] });
      },
      editProductGroupRelationAction: (previousCode, relation) => {
        const data = get();
        const productGroupRelations = data.productGroupRelations ?? [];
        set({ productGroupRelations: [...productGroupRelations.filter((item) => item.code !== previousCode && item.code !== relation.code), relation] });
      },
      deleteProductGroupRelationAction: (code) => {
        const data = get();
        set({ productGroupRelations: (data.productGroupRelations ?? []).filter((item) => item.code !== code) });
      },
      batchDeleteProductGroupRelationAction: (codes) => {
        const data = get();
        set({ productGroupRelations: (data.productGroupRelations ?? []).filter((item) => !codes.includes(item.code)) });
      },
      createProductionCalendarAction: (calendar) => {
        const data = get();
        set({ productionCalendars: [...data.productionCalendars.filter((item) => item.code !== calendar.code), calendar] });
      },
      editProductionCalendarAction: (previousCode, calendar) => {
        const data = get();
        set({ productionCalendars: [...data.productionCalendars.filter((item) => item.code !== previousCode && item.code !== calendar.code), calendar] });
      },
      deleteProductionCalendarAction: (calendarCode) => {
        const data = get();
        set({ productionCalendars: data.productionCalendars.filter((item) => item.code !== calendarCode) });
      },
      batchDeleteProductionCalendarAction: (calendarCodes) => {
        const data = get();
        set({ productionCalendars: data.productionCalendars.filter((item) => !calendarCodes.includes(item.code)) });
      },
      createMaterialAction: (material) => {
        const data = get();
        set({ materials: [normalizeMaterial(material), ...data.materials.filter((item) => item.code !== material.code)] });
      },
      editMaterialAction: (previousCode, material) => {
        const data = get();
        const nextMaterial = normalizeMaterial(material);
        const materials = [...data.materials.filter((item) => item.code !== previousCode && item.code !== nextMaterial.code), nextMaterial];
        const materialRequirements = data.materialRequirements.map((requirement) => (requirement.materialCode === previousCode || requirement.materialCode === nextMaterial.code)
          ? { ...requirement, materialCode: nextMaterial.code, materialAttr: nextMaterial.materialAttr }
          : requirement);
        const bomItems = data.bomItems.map((item) => (item.materialCode === previousCode || item.materialCode === nextMaterial.code)
          ? { ...item, materialCode: nextMaterial.code, materialAttr: nextMaterial.materialAttr }
          : item);
        const cleanedBatchArtifacts = pruneInvalidChildBatchArtifacts(materials, materialRequirements, data.productionOrders, data.batchWorkOrders, data.formulaSheets);
        set({
          materials,
          materialRequirements,
          bomItems,
          ...cleanedBatchArtifacts,
        });
      },
      deleteMaterialAction: (materialCode) => {
        const data = get();
        set({ materials: data.materials.filter((material) => material.code !== materialCode) });
      },
      toggleMaterialEnabledAction: (materialCode) => {
        const data = get();
        set({
          materials: data.materials.map((material) => material.code === materialCode ? { ...material, enabled: !material.enabled } : material),
        });
      },
      createInventoryAction: (item) => {
        const data = get();
        const nextItem = normalizeInventoryItem(item);
        set({ inventory: [...data.inventory.filter((entry) => entry.id !== nextItem.id), nextItem] });
      },
      editInventoryAction: (previousId, item) => {
        const data = get();
        const nextItem = normalizeInventoryItem(item);
        set({ inventory: [...data.inventory.filter((entry) => entry.id !== previousId && entry.id !== nextItem.id), nextItem] });
      },
      deleteInventoryAction: (id) => {
        const data = get();
        set({ inventory: data.inventory.filter((entry) => entry.id !== id) });
      },
      createBomHeaderAction: (header, items) => {
        const data = get();
        set({
          bomHeaders: [...data.bomHeaders.filter((item) => item.code !== header.code), header],
          bomItems: [...data.bomItems.filter((item) => item.bomCode !== header.code), ...items],
        });
      },
      updateBomHeaderAction: (previousCode, header, items) => {
        const data = get();
        set({
          bomHeaders: [...data.bomHeaders.filter((item) => item.code !== previousCode && item.code !== header.code), header],
          bomItems: [...data.bomItems.filter((item) => item.bomCode !== previousCode && item.bomCode !== header.code), ...items],
        });
      },
      deleteBomHeadersAction: (headerCodes) => {
        const data = get();
        set({
          bomHeaders: data.bomHeaders.filter((item) => !headerCodes.includes(item.code)),
          bomItems: data.bomItems.filter((item) => !headerCodes.includes(item.bomCode)),
        });
      },
      createProductionFormAction: (form) => {
        const data = get();
        set({ productionForms: [...data.productionForms.filter((item) => item.code !== form.code), form] });
      },
      editProductionFormAction: (previousCode, form) => {
        const data = get();
        set({
          productionForms: [...data.productionForms.filter((item) => item.code !== previousCode && item.code !== form.code), form],
          productionProcesses: data.productionProcesses.map((item) => item.formCode === previousCode ? { ...item, formCode: form.code } : item),
        });
      },
      deleteProductionFormsAction: (codes) => {
        const data = get();
        const codeSet = new Set(codes);
        set({
          productionForms: data.productionForms.filter((item) => !codeSet.has(item.code)),
          productionProcesses: data.productionProcesses.map((item) => (item.formCode && codeSet.has(item.formCode) ? { ...item, formCode: undefined } : item)),
        });
      },
      updateProductionFormDesignAction: (code, fields) => {
        const data = get();
        set({
          productionForms: data.productionForms.map((item) => item.code === code ? { ...item, fields } : item),
        });
      },
      createProductionProcessAction: (process) => {
        const data = get();
        const nextProcess = normalizeProductionProcess(process);
        set({ productionProcesses: [...data.productionProcesses.filter((item) => item.code !== nextProcess.code), nextProcess] });
      },
      editProductionProcessAction: (previousCode, process) => {
        const data = get();
        const nextProcess = normalizeProductionProcess(process);
        set({
          productionProcesses: [...data.productionProcesses.filter((item) => item.code !== previousCode && item.code !== nextProcess.code), nextProcess],
          productionCrafts: data.productionCrafts.map((craft) => ({
            ...craft,
            nodes: craft.nodes.map((node) => node.processCode === previousCode ? { ...node, processCode: nextProcess.code } : node),
          })),
        });
      },
      deleteProductionProcessesAction: (codes) => {
        const data = get();
        const codeSet = new Set(codes);
        set({
          productionProcesses: data.productionProcesses.filter((item) => !codeSet.has(item.code)),
          productionCrafts: data.productionCrafts.map((craft) => ({
            ...craft,
            nodes: craft.nodes.filter((node) => !codeSet.has(node.processCode)),
            edges: craft.edges.filter((edge) => {
              const nodeIds = new Set(craft.nodes.filter((node) => !codeSet.has(node.processCode)).map((node) => node.id));
              return nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId);
            }),
          })),
        });
      },
      createProductionCraftAction: (craft) => {
        const data = get();
        set({ productionCrafts: normalizeProductionCrafts([...data.productionCrafts.filter((item) => item.code !== craft.code), craft]) });
      },
      editProductionCraftAction: (previousCode, craft) => {
        const data = get();
        set({
          productionCrafts: normalizeProductionCrafts([...data.productionCrafts.filter((item) => item.code !== previousCode && item.code !== craft.code), craft]),
        });
      },
      deleteProductionCraftsAction: (codes) => {
        const data = get();
        const codeSet = new Set(codes);
        set({ productionCrafts: data.productionCrafts.filter((item) => !codeSet.has(item.code)) });
      },
      updateProductionCraftConfigAction: (code, payload) => {
        const data = get();
        set({
          productionCrafts: normalizeProductionCrafts(data.productionCrafts.map((item) => item.code === code ? { ...item, nodes: payload.nodes, edges: payload.edges } : item)),
        });
      },
      createSalesOrderAction: () => {
        const data = get();
        const nextId = createSalesOrderId(data.salesOrders);
        const firstCustomer = data.customers[0]?.code ?? 'CUST-A';
        const firstProduct = data.materials.find((item) => item.type === '主产品')?.code ?? data.materials[0]?.code ?? 'PROD-A';
        const newOrder = {
          id: nextId,
          customerCode: firstCustomer,
          productCode: firstProduct,
          quantity: 1200 + data.salesOrders.length * 200,
          unit: 'kg',
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          packageRequirement: '25kg/包',
          demandSource: 'ERP' as const,
          status: '已提交' as const,
          sortOrder: 0,
          pushedQuantity: 0,
          remainingQuantity: 1200 + data.salesOrders.length * 200,
          productionOrderIds: [],
          kitReadyStatus: '未评估' as const,
          kitReadyQuantity: 0,
          mrpFulfillmentDate: undefined,
          shortageLines: [],
          createdAt: nowIso(),
        };
        set({ salesOrders: insertSalesOrderByDeliveryDate(data.salesOrders, newOrder) });
      },
      addSalesOrderAction: (salesOrder) => {
        const data = get();
        const nextOrder = { ...salesOrder, demandSource: salesOrder.demandSource ?? 'ERP', status: '已提交' as const, pushedQuantity: 0, remainingQuantity: salesOrder.quantity, productionOrderIds: salesOrder.productionOrderIds ?? [], kitReadyQuantity: salesOrder.kitReadyQuantity ?? 0, mrpFulfillmentDate: salesOrder.mrpFulfillmentDate, shortageLines: salesOrder.shortageLines ?? [] };
        set({ salesOrders: insertSalesOrderByDeliveryDate(data.salesOrders, nextOrder) });
      },
      editSalesOrderAction: (previousId, salesOrder) => {
        const data = get();
        const previous = data.salesOrders.find((item) => item.id === previousId);
        const nextOrder = { ...salesOrder, demandSource: salesOrder.demandSource ?? 'ERP', status: '已提交' as const, pushedQuantity: salesOrder.pushedQuantity ?? 0, remainingQuantity: salesOrder.remainingQuantity ?? salesOrder.quantity, productionOrderIds: salesOrder.productionOrderIds ?? [], kitReadyQuantity: salesOrder.kitReadyQuantity ?? 0, mrpFulfillmentDate: salesOrder.mrpFulfillmentDate, shortageLines: salesOrder.shortageLines ?? [] };
        if (previous && previous.deliveryDate === nextOrder.deliveryDate) {
          set({ salesOrders: sortSalesOrdersByManualOrder([...data.salesOrders.filter((item) => item.id !== previousId && item.id !== nextOrder.id), nextOrder]) });
          return;
        }
        set({ salesOrders: insertSalesOrderByDeliveryDate(data.salesOrders.filter((item) => item.id !== previousId), nextOrder) });
      },
      deleteSalesOrderAction: (salesOrderId) => {
        const data = get();
        set({ salesOrders: data.salesOrders.filter((item) => item.id !== salesOrderId) });
      },
      reorderSalesOrdersAction: (orderedIds) => {
        const data = get();
        const orderedIdSet = new Set(orderedIds);
        const ordered = orderedIds
          .map((id) => data.salesOrders.find((item) => item.id === id))
          .filter(Boolean) as MesStateData['salesOrders'];
        const remaining = sortSalesOrdersByManualOrder(data.salesOrders.filter((item) => !orderedIdSet.has(item.id)));
        set({ salesOrders: normalizeSalesOrderSortOrders([...ordered, ...remaining]) });
      },
      splitSalesOrderAction: (salesOrderId, splitOrders) => {
        const data = get();
        const source = data.salesOrders.find((item) => item.id === salesOrderId);
        if (!source) throw new Error('原销售订单不存在');
        if ((source.remainingQuantity ?? source.quantity) <= 0) throw new Error('剩余数量为 0 的销售订单不支持下推');
        const sourceAvailable = source.remainingQuantity ?? source.quantity;
        const splitTotal = splitOrders.reduce((sum, item) => sum + item.quantity, 0);
        if (splitTotal > sourceAvailable) throw new Error('拆分数量不能超过剩余数量');
        const nextIndex = data.productionOrders.length + 1;
        const newProductionOrders: MesStateData['productionOrders'] = [];
        const newMaterialRequirements: MaterialRequirement[] = [];
        let nextReservations = data.inventoryReservations ?? [];
        splitOrders.forEach((item, index) => {
          const bundle = buildProductionOrderFromSources({ ...data, productionOrders: [...data.productionOrders, ...newProductionOrders], inventoryReservations: nextReservations }, `MO${String(nextIndex + index).padStart(3, '0')}`, [{
            salesOrderId: source.id,
            productCode: source.productCode,
            quantity: item.quantity,
            unit: source.unit,
            deliveryDate: item.deliveryDate,
            packageRequirement: source.packageRequirement,
          }], data.productionOrders, newProductionOrders);
          newProductionOrders.push(bundle.productionOrder);
          newMaterialRequirements.push(...bundle.materialRequirements);
          nextReservations = mergeReservationsForProductionOrders(
            { ...data, productionOrders: [...data.productionOrders, ...newProductionOrders], materialRequirements: [...data.materialRequirements, ...newMaterialRequirements], inventoryReservations: nextReservations },
            nextReservations,
            [bundle.productionOrder],
            bundle.materialRequirements,
          );
        });
        const nextProductionOrders = [...data.productionOrders, ...newProductionOrders];
        const nextMaterialRequirements = [...data.materialRequirements, ...newMaterialRequirements];
        const shortageMap = aggregateShortageLines(data, nextProductionOrders, nextMaterialRequirements);
        const inventoryReservations = nextReservations;
        set({
          salesOrders: syncSalesOrdersAfterProductionOrderChanges(data, nextProductionOrders, shortageMap),
          productionOrders: nextProductionOrders,
          materialRequirements: nextMaterialRequirements,
          inventoryReservations,
        });
      },
      mergeSalesOrdersAction: (salesOrderIds, mergedOrder) => {
        const data = get();
        const sourceOrders = data.salesOrders.filter((item) => salesOrderIds.includes(item.id));
        if (!sourceOrders.length) throw new Error('请选择要合并的销售订单');
        if (sourceOrders.some((order) => (order.remainingQuantity ?? order.quantity) <= 0)) throw new Error('剩余数量为 0 的销售订单不支持下推');
        const mergeFields = normalizeMrpRule(data.mrpRule).autoPushMergeFields;
        if (mergeFields.includes('productCode') && new Set(sourceOrders.map((order) => order.productCode)).size > 1) throw new Error('不同主产品的销售订单不支持合并下推');
        if (mergeFields.includes('customerCode') && new Set(sourceOrders.map((order) => order.customerCode)).size > 1) throw new Error('不同客户的销售订单不支持合并下推');
        if (mergeFields.includes('deliveryDate') && new Set(sourceOrders.map((order) => order.deliveryDate)).size > 1) throw new Error('不同交期的销售订单不支持合并下推');
        if (mergeFields.includes('demandSource') && new Set(sourceOrders.map((order) => order.demandSource ?? 'ERP')).size > 1) throw new Error('不同业务来源的销售订单不支持合并下推');
        if (mergeFields.includes('unit') && new Set(sourceOrders.map((order) => order.unit)).size > 1) throw new Error('不同单位的销售订单不支持合并下推');
        if (mergeFields.includes('packageRequirement') && new Set(sourceOrders.map((order) => order.packageRequirement)).size > 1) throw new Error('不同包装要求的销售订单不支持合并下推');
        const nextIndex = data.productionOrders.length + 1;
        const bundle = buildProductionOrderFromSources(data, `MO${String(nextIndex).padStart(3, '0')}`, sourceOrders.map((order) => ({
          salesOrderId: order.id,
          productCode: order.productCode,
          quantity: order.remainingQuantity ?? order.quantity,
          unit: order.unit,
          deliveryDate: order.deliveryDate,
          packageRequirement: order.packageRequirement,
        })), data.productionOrders, []);
        const nextProductionOrders = [...data.productionOrders, bundle.productionOrder];
        const nextMaterialRequirements = [...data.materialRequirements, ...bundle.materialRequirements];
        const shortageMap = aggregateShortageLines(data, nextProductionOrders, nextMaterialRequirements);
        const inventoryReservations = mergeReservationsForProductionOrders(
          { ...data, productionOrders: nextProductionOrders, materialRequirements: nextMaterialRequirements },
          data.inventoryReservations ?? [],
          [bundle.productionOrder],
          nextMaterialRequirements,
        );
        set({
          salesOrders: syncSalesOrdersAfterProductionOrderChanges(data, nextProductionOrders, shortageMap),
          productionOrders: nextProductionOrders,
          materialRequirements: nextMaterialRequirements,
          inventoryReservations,
        });
      },
      closeSalesOrderAction: (salesOrderId) => {
        const data = get();
        set({
          salesOrders: data.salesOrders.map((order) => order.id === salesOrderId ? { ...order, status: '已关闭' } : order),
        });
      },
      pushSalesOrdersToProductionOrdersAction: (salesOrderIds) => {
        const data = get();
        const sourceOrders = data.salesOrders.filter((order) => salesOrderIds.includes(order.id) && order.status === '已提交');
        if (!sourceOrders.length) {
          throw new Error('请选择已提交的销售订单');
        }
        if (sourceOrders.some((order) => (order.remainingQuantity ?? order.quantity) <= 0)) {
          throw new Error('剩余数量为 0 的销售订单不支持下推');
        }

        const nextProductionOrders = [...data.productionOrders];
        const nextMaterialRequirements = [...data.materialRequirements];
        const newProductionOrders: MesStateData['productionOrders'] = [];
        let nextReservations = data.inventoryReservations ?? [];

        sourceOrders.forEach((salesOrder) => {
          const nextIndex = nextProductionOrders.length + newProductionOrders.length + 1;
          const bundle = buildProductionOrderFromSources({ ...data, productionOrders: [...data.productionOrders, ...newProductionOrders], inventoryReservations: nextReservations }, `MO${String(nextIndex).padStart(3, '0')}`, [{
            salesOrderId: salesOrder.id,
            productCode: salesOrder.productCode,
            quantity: salesOrder.remainingQuantity ?? salesOrder.quantity,
            unit: salesOrder.unit,
            deliveryDate: salesOrder.deliveryDate,
            packageRequirement: salesOrder.packageRequirement,
          }], data.productionOrders, newProductionOrders);
          nextMaterialRequirements.push(...bundle.materialRequirements);
          newProductionOrders.push(bundle.productionOrder);
          nextReservations = mergeReservationsForProductionOrders(
            { ...data, productionOrders: [...data.productionOrders, ...newProductionOrders], materialRequirements: nextMaterialRequirements, inventoryReservations: nextReservations },
            nextReservations,
            [bundle.productionOrder],
            bundle.materialRequirements,
          );
        });
        nextProductionOrders.push(...newProductionOrders);

        const shortageMap = aggregateShortageLines(data, nextProductionOrders, nextMaterialRequirements);
        const inventoryReservations = nextReservations;

        set({
          salesOrders: syncSalesOrdersAfterProductionOrderChanges(data, nextProductionOrders, shortageMap),
          productionOrders: nextProductionOrders,
          materialRequirements: nextMaterialRequirements,
          inventoryReservations,
        });
      },
      pushProductionOrderToScheduleAction: (productionOrderId) => {
        const data = get();
        const plannedOrder = createProductionOrderSchedulePlan(data, productionOrderId);
        set({
          productionOrders: data.productionOrders.map((item) => item.id === productionOrderId ? plannedOrder : item),
        });
      },
      pushProductionOrdersToScheduleAction: (productionOrderIds) => {
        const data = get();
        const plannedOrders = createProductionOrderSchedulePlans(data, productionOrderIds);
        const plannedOrderById = new Map(plannedOrders.map((item) => [item.id, item]));
        set({
          productionOrders: data.productionOrders.map((item) => plannedOrderById.get(item.id) ?? item),
        });
      },
      recallProductionOrderScheduleAction: (productionOrderId) => {
        const data = get();
        const recalledOrder = clearProductionOrderSchedulePlan(data, productionOrderId);
        set({
          productionOrders: data.productionOrders.map((item) => item.id === productionOrderId ? recalledOrder : item),
        });
      },
      updateProductionOrderSchedulePlanAction: (productionOrderId, payload) => {
        const data = get();
        const plannedOrder = updateProductionOrderSchedulePlan(data, productionOrderId, payload);
        set({
          productionOrders: data.productionOrders.map((item) => item.id === productionOrderId ? plannedOrder : item),
        });
      },
      updateProductionOrderScheduleWindowAction: (productionOrderId, payload) => {
        const data = get();
        const plannedOrder = updateProductionOrderScheduleWindow(data, productionOrderId, payload);
        set({
          productionOrders: data.productionOrders.map((item) => item.id === productionOrderId ? plannedOrder : item),
        });
      },
      outputProductionOrdersToScheduleAction: (productionOrderIds) => {
        const data = get();
        const scheduleItems = createScheduleItemsFromProductionOrders(data, productionOrderIds);
        set({ scheduleItems: [...data.scheduleItems, ...scheduleItems] });
      },
      recallScheduleOutputAction: (scheduleItemIds) => {
        const data = get();
        set(applyRecallScheduleOutput(data, scheduleItemIds));
      },
      deleteProductionOrderAction: (productionOrderId) => {
        const data = get();
        const order = data.productionOrders.find((item) => item.id === productionOrderId);
        if (!order) throw new Error('生产订单不存在');
        if (order.status !== '未排程') {
          throw new Error('仅未排程的生产订单支持删除');
        }
        const nextProductionOrders = data.productionOrders.filter((item) => item.id !== productionOrderId);
        const nextMaterialRequirements = data.materialRequirements.filter((item) => item.productionOrderId !== productionOrderId);
        const nextScheduleItems = data.scheduleItems.filter((item) => item.productionOrderId !== productionOrderId);
        const shortageMap = aggregateShortageLines(data, nextProductionOrders, nextMaterialRequirements);
        set({
          salesOrders: syncSalesOrdersAfterProductionOrderChanges({ ...data, materialRequirements: nextMaterialRequirements }, nextProductionOrders, shortageMap),
          productionOrders: nextProductionOrders,
          materialRequirements: nextMaterialRequirements,
          scheduleItems: nextScheduleItems,
          inventoryReservations: releaseReservationsForProductionOrder(data.inventoryReservations ?? [], productionOrderId),
        });
      },
      replenishProductionOrderKitAction: (productionOrderIds) => {
        const data = get();
        set(applyReplenishProductionOrderKit(data, productionOrderIds));
      },
      updateMaterialRequirementAction: (requirementId, requirement) => {
        const data = get();
        const materialRequirements = data.materialRequirements.map((item) => item.id === requirementId ? requirement : item);
        const cleanedBatchArtifacts = pruneInvalidChildBatchArtifacts(data.materials, materialRequirements, data.productionOrders, data.batchWorkOrders, data.formulaSheets);
        set({
          materialRequirements,
          ...cleanedBatchArtifacts,
        });
      },
      updateScheduleRulesAction: (rules) => set({ scheduleRules: normalizeScheduleRules(rules) }),
      resetScheduleRulesAction: () => set({ scheduleRules: normalizeScheduleRules(defaultScheduleRules) }),
      updateMrpRuleAction: (rule) => set({ mrpRule: normalizeMrpRule(rule) }),
      runMrpForOrders: () => {
        const data = get();
        const submitOrders = data.salesOrders.filter((order) => order.status === '已提交');
        if (!submitOrders.length) {
          throw new Error('请先准备已提交的销售订单');
        }
        const runIds = submitOrders.map((order) => order.id);
        const sortedData = { ...data, salesOrders: sortSalesOrdersByManualOrder(data.salesOrders) };
        const result = runMrp(sortedData, runIds);
        const mrpUpdatedSalesOrders = data.salesOrders.map((order) => {
          if (order.status !== '已提交') return order;
          const latest = result.orderStatusMap.get(order.id);
          return {
            ...order,
            demandSource: order.demandSource ?? 'ERP',
            kitReadyStatus: latest?.kitReadyStatus ?? order.kitReadyStatus,
            kitReadyQuantity: latest?.producibleQuantity ?? order.kitReadyQuantity ?? 0,
            mrpFulfillmentDate: latest?.mrpFulfillmentDate,
            shortageLines: latest?.shortageLines ?? order.shortageLines,
          };
        });
        const sortedDataWithMrp = { ...sortedData, salesOrders: mrpUpdatedSalesOrders };
        const autoPush = applyMrpAutoPush(sortedDataWithMrp, result.orderStatusMap, runIds);
        const shortageMap = aggregateShortageLines(
          sortedDataWithMrp,
          autoPush.productionOrders,
          autoPush.materialRequirements,
        );
        const salesOrders = syncSalesOrdersAfterProductionOrderChanges(
          sortedDataWithMrp,
          autoPush.productionOrders,
          shortageMap,
        );
        const mrpLog = {
          ...result.log,
          productionOrderIds: [...data.productionOrders.map((order) => order.id), ...autoPush.newProductionOrderIds],
          remark: autoPush.newProductionOrderIds.length
            ? `MRP 运算完成，自动生成 ${autoPush.newProductionOrderIds.length} 张生产订单`
            : 'MRP 运算完成，无缺料齐套部分可自动下推',
        };
        set({
          salesOrders,
          productionOrders: autoPush.productionOrders,
          materialRequirements: autoPush.materialRequirements,
          scheduleItems: autoPush.scheduleItems,
          inventoryReservations: autoPush.inventoryReservations,
          mrpLogs: [...data.mrpLogs, mrpLog],
          materialShortages: result.shortageSummaries,
        });
      },
      pushDownSchedule: (scheduleItemIds) => {
        const data = get();
        if (scheduleItemIds && !scheduleItemIds.length) {
          throw new Error('请选择要下推的排程单');
        }
        const selectedScheduleIds = scheduleItemIds ? new Set(scheduleItemIds) : null;
        const targetScheduleItems = data.scheduleItems.filter((item) => item.status === '待下推' && (!selectedScheduleIds || selectedScheduleIds.has(item.id)));
        if (!targetScheduleItems.length) {
          throw new Error('没有可下推的排程单');
        }
        const targetScheduleItemIds = targetScheduleItems.map((item) => item.id);
        const newWorkOrders = generateBatchWorkOrders(data, targetScheduleItemIds).map((order) => ({ ...order, status: '待审核' as const }));
        const newFormulas = generateFormulaSheets(data, newWorkOrders);
        const cleanedBatchArtifacts = pruneInvalidChildBatchArtifacts(
          data.materials,
          data.materialRequirements,
          data.productionOrders,
          [...data.batchWorkOrders, ...newWorkOrders],
          [...data.formulaSheets, ...newFormulas],
        );
        const pushedScheduleItemIds = new Set(targetScheduleItemIds);
        set({
          scheduleItems: data.scheduleItems.map((item) => pushedScheduleItemIds.has(item.id) ? { ...item, status: '待执行' as const } : item),
          ...cleanedBatchArtifacts,
        });
      },
      recallSchedulePushdown: (scheduleItemIds) => {
        const data = get();
        set(applyRecallSchedulePushdown(data, scheduleItemIds));
      },
      pruneInvalidChildBatchWorkOrdersAction: () => {
        const data = get();
        const cleanedBatchArtifacts = pruneInvalidChildBatchArtifacts(data.materials, data.materialRequirements, data.productionOrders, data.batchWorkOrders, data.formulaSheets);
        if (cleanedBatchArtifacts.batchWorkOrders !== data.batchWorkOrders || cleanedBatchArtifacts.formulaSheets !== data.formulaSheets) {
          set(cleanedBatchArtifacts);
        }
      },
      pickInventoryReservationAction: (reservationId, quantity) => {
        const data = get();
        const pickedQuantity = Number(quantity);
        if (!Number.isFinite(pickedQuantity) || pickedQuantity <= 0) {
          throw new Error('请输入大于 0 的领料数量');
        }
        const reservation = data.inventoryReservations.find((item) => item.id === reservationId);
        if (!reservation) throw new Error('库存占用记录不存在');
        const currentReservedQuantity = getCurrentReservedQuantity(reservation);
        if (pickedQuantity > currentReservedQuantity) {
          throw new Error('领料数量不能超过当前占用数量');
        }
        set({
          inventoryReservations: data.inventoryReservations.map((item) => item.id === reservationId
            ? {
              ...item,
              pickedQuantity: Number(((item.pickedQuantity ?? 0) + pickedQuantity).toFixed(2)),
              updatedAt: nowIso(),
            }
            : item),
        });
      },
      returnInventoryReservationAction: (reservationId, quantity) => {
        const data = get();
        const returnedQuantity = Number(quantity);
        if (!Number.isFinite(returnedQuantity) || returnedQuantity <= 0) {
          throw new Error('请输入大于 0 的退料数量');
        }
        const reservation = data.inventoryReservations.find((item) => item.id === reservationId);
        if (!reservation) throw new Error('库存占用记录不存在');
        if ((reservation.reservationLocation ?? '仓库') !== '线边仓') {
          throw new Error('仅线边仓MRP库存占用单支持退料');
        }
        const currentReservedQuantity = getCurrentReservedQuantity(reservation);
        if (returnedQuantity > currentReservedQuantity) {
          throw new Error('退料数量不能超过当前占用数量');
        }
        set({
          inventoryReservations: data.inventoryReservations.map((item) => item.id === reservationId
            ? {
              ...item,
              returnedQuantity: Number(((item.returnedQuantity ?? 0) + returnedQuantity).toFixed(2)),
              updatedAt: nowIso(),
            }
            : item),
        });
      },
      pickProductionOrderByBarcodeAction: (productionOrderId, barcodeCode) => {
        const data = get();
        const code = barcodeCode.trim();
        if (!code) throw new Error('请输入条码');
        const order = data.productionOrders.find((item) => item.id === productionOrderId);
        if (!order) throw new Error('生产订单不存在');
        const barcode = data.barcodes.find((item) => item.code === code);
        if (!barcode) throw new Error('条码不存在');
        if ((barcode.inventoryStatus ?? '库内') !== '库内') throw new Error('条码库存状态不是库内，不能领料');
        if (barcode.remainingQuantity <= 0) throw new Error('条码剩余数量为 0，不能领料');
        const targetReservations = data.inventoryReservations
          .filter((item) => item.sourceType === '生产订单'
            && item.sourceId === productionOrderId
            && item.materialCode === barcode.materialCode
            && getReservationLocation(item) === '仓库'
            && getCurrentReservedQuantity(item) > 0);
        if (!targetReservations.length) throw new Error('该条码物料未匹配到当前生产订单的仓库MRP库存占用单');
        let remainingPickQuantity = Math.min(
          barcode.remainingQuantity,
          targetReservations.reduce((sum, item) => Number((sum + getCurrentReservedQuantity(item)).toFixed(2)), 0),
        );
        set({
          barcodes: data.barcodes.map((item) => item.code === code ? { ...item, inventoryStatus: '库外' as const } : item),
          inventoryReservations: data.inventoryReservations.map((item) => {
            if (!targetReservations.some((reservation) => reservation.id === item.id) || remainingPickQuantity <= 0) return item;
            const pickQuantity = Math.min(getCurrentReservedQuantity(item), remainingPickQuantity);
            remainingPickQuantity = Number((remainingPickQuantity - pickQuantity).toFixed(2));
            return {
              ...item,
              pickedQuantity: Number(((item.pickedQuantity ?? 0) + pickQuantity).toFixed(2)),
              updatedAt: nowIso(),
            };
          }),
        });
      },
      returnProductionOrderByBarcodeAction: (productionOrderId, barcodeCode) => {
        const data = get();
        const code = barcodeCode.trim();
        if (!code) throw new Error('请输入条码');
        const order = data.productionOrders.find((item) => item.id === productionOrderId);
        if (!order) throw new Error('生产订单不存在');
        const barcode = data.barcodes.find((item) => item.code === code);
        if (!barcode) throw new Error('条码不存在');
        if (barcode.inventoryStatus !== '库外') throw new Error('条码库存状态不是库外，不能退料');
        const relatedMaterialCodes = new Set(data.materialRequirements
          .filter((item) => item.productionOrderId === productionOrderId && item.kitCheckTarget)
          .map((item) => item.materialCode));
        if (!relatedMaterialCodes.has(barcode.materialCode)) throw new Error('该条码物料不属于当前生产订单用料');
        set({
          barcodes: data.barcodes.map((item) => item.code === code ? { ...item, inventoryStatus: '库内' as const } : item),
        });
      },
      updateFormulaLineBatchesAction: (formulaId, lineId, batches) => {
        const data = get();
        const seen = new Set<string>();
        const normalizedBatches = batches
          .map((batch) => ({ batchNo: String(batch.batchNo ?? '').trim() }))
          .filter((batch) => {
            if (!batch.batchNo || seen.has(batch.batchNo)) return false;
            seen.add(batch.batchNo);
            return true;
          });
        set({
          formulaSheets: data.formulaSheets.map((formula) => formula.id === formulaId
            ? {
              ...formula,
              status: '待审核' as const,
              lines: formula.lines.map((line) => line.id === lineId ? { ...line, specifiedBatches: normalizedBatches, specifiedBatchNo: normalizedBatches[0]?.batchNo } : line),
            }
            : formula),
        });
      },
      approveFormulaAction: (formulaId) => {
        const data = get();
        const formula = data.formulaSheets.find((item) => item.id === formulaId);
        if (!formula) throw new Error('配方单不存在');
        set({
          formulaSheets: data.formulaSheets.map((item) => item.id === formulaId ? { ...item, status: '已审核' as const } : item),
          batchWorkOrders: data.batchWorkOrders.map((order) => order.id === formula.batchWorkOrderId && (order.status === '待审核' || order.status === '待配方') ? { ...order, status: '待执行' as const } : order),
        });
      },
      approveAllFormulas: () => {
        const data = get();
        set({
          formulaSheets: data.formulaSheets.map((formula) => ({ ...formula, status: '已审核' })),
          batchWorkOrders: data.batchWorkOrders.map((order) => order.status === '待审核' || order.status === '待配方' ? { ...order, status: '待执行' } : order),
        });
      },
      startBatchWorkOrderAction: (batchWorkOrderId) => {
        const data = get();
        const nextBatchWorkOrders = data.batchWorkOrders.map((item) => item.id === batchWorkOrderId && (item.status === '待执行' || item.status === '暂停中') ? { ...item, status: '执行中' as const } : item);
        set({
          batchWorkOrders: nextBatchWorkOrders,
          scheduleItems: syncScheduleItemsAfterBatchChange(data, nextBatchWorkOrders),
          executionRecords: [...data.executionRecords, makeExecutionRecord(data, batchWorkOrderId, '开工')],
        });
      },
      pauseBatchWorkOrderAction: (batchWorkOrderId) => {
        const data = get();
        const nextBatchWorkOrders = data.batchWorkOrders.map((item) => item.id === batchWorkOrderId && item.status === '执行中' ? { ...item, status: '暂停中' as const } : item);
        set({
          batchWorkOrders: nextBatchWorkOrders,
          scheduleItems: syncScheduleItemsAfterBatchChange(data, nextBatchWorkOrders),
          executionRecords: [...data.executionRecords, makeExecutionRecord(data, batchWorkOrderId, '暂停')],
        });
      },
      completeBatchWorkOrderAction: (batchWorkOrderId) => {
        const data = get();
        const nextBatchWorkOrders = data.batchWorkOrders.map((item) => item.id === batchWorkOrderId ? { ...item, status: '已完成' as const } : item);
        set({
          batchWorkOrders: nextBatchWorkOrders,
          scheduleItems: syncScheduleItemsAfterBatchChange(data, nextBatchWorkOrders),
          executionRecords: [...data.executionRecords, makeExecutionRecord(data, batchWorkOrderId, '完工')],
        });
      },
      feedByBarcodeAction: (batchWorkOrderId, barcodeCode, actualQuantity, feedPort, remainingQuantity) => {
        const data = get();
        const barcodeBeforeFeed = data.barcodes.find((item) => item.code === barcodeCode);
        const result = feedByBarcode(data, batchWorkOrderId, barcodeCode, actualQuantity, feedPort, remainingQuantity);
        const consumedQuantity = barcodeBeforeFeed ? Number((barcodeBeforeFeed.remainingQuantity - result.barcode.remainingQuantity).toFixed(2)) : actualQuantity;
        set({
          barcodes: data.barcodes.map((item) => item.code === result.barcode.code ? result.barcode : item),
          inventory: result.inventory,
          feedRecords: [...data.feedRecords, result.feedRecord],
          lossRecords: result.lossRecord ? [...data.lossRecords, result.lossRecord] : data.lossRecords,
          inventoryReservations: consumeLineSideReservations(data.inventoryReservations, result.workOrder.productionOrderId, result.feedRecord.materialCode, consumedQuantity),
          batchWorkOrders: data.batchWorkOrders.map((item) => item.id === result.workOrder.id ? result.workOrder : item),
          scheduleItems: syncScheduleItemsAfterBatchChange(data, data.batchWorkOrders.map((item) => item.id === result.workOrder.id ? result.workOrder : item)),
          executionRecords: [...data.executionRecords, makeExecutionRecord(data, batchWorkOrderId, '扫码投料')],
        });
      },
      feedFromTankAction: (batchWorkOrderId, tankCode, before, after) => {
        const data = get();
        const result = feedFromTank(data, batchWorkOrderId, tankCode, before, after);
        set({
          tanks: data.tanks.map((item) => item.code === result.tank.code ? result.tank : item),
          inventory: result.inventory,
          feedRecords: [...data.feedRecords, result.feedRecord],
          batchWorkOrders: data.batchWorkOrders.map((item) => item.id === result.workOrder.id ? result.workOrder : item),
          scheduleItems: syncScheduleItemsAfterBatchChange(data, data.batchWorkOrders.map((item) => item.id === result.workOrder.id ? result.workOrder : item)),
          executionRecords: [...data.executionRecords, makeExecutionRecord(data, batchWorkOrderId, '储罐投料')],
        });
      },
      packageWorkOrderAction: (batchWorkOrderId, weight) => {
        const data = get();
        const result = packageWorkOrder(data, batchWorkOrderId, weight);
        set({
          barcodes: [...data.barcodes, result.barcode],
          packageRecords: [...data.packageRecords, result.packageRecord],
          inventory: [...data.inventory, result.inventoryItem],
          batchWorkOrders: data.batchWorkOrders.map((item) => item.id === result.workOrder.id ? result.workOrder : item),
          scheduleItems: syncScheduleItemsAfterBatchChange(data, data.batchWorkOrders.map((item) => item.id === result.workOrder.id ? result.workOrder : item)),
          executionRecords: [...data.executionRecords, makeExecutionRecord(data, batchWorkOrderId, '包装打码')],
        });
      },
      deletePackageBarcodeAction: (barcodeCode) => {
        const data = get();
        const packageRecord = data.packageRecords.find((item) => item.barcodeCode === barcodeCode);
        if (!packageRecord) throw new Error('包装条码不存在');
        const barcode = data.barcodes.find((item) => item.code === barcodeCode);
        if (barcode && barcode.remainingQuantity < barcode.initialQuantity) {
          throw new Error('条码已被使用，不能删除');
        }
        const nextPackageRecords = data.packageRecords.filter((item) => item.barcodeCode !== barcodeCode);
        const workOrder = data.batchWorkOrders.find((item) => item.id === packageRecord.batchWorkOrderId);
        const packedQuantity = nextPackageRecords
          .filter((item) => item.batchWorkOrderId === packageRecord.batchWorkOrderId)
          .reduce((sum, item) => sum + item.weight, 0);
        const nextBatchWorkOrders = workOrder
          ? data.batchWorkOrders.map((item) => item.id === workOrder.id
            ? { ...item, status: packedQuantity >= item.plannedQuantity ? '已完成' as const : '执行中' as const }
            : item)
          : data.batchWorkOrders;
        set({
          barcodes: data.barcodes.filter((item) => item.code !== barcodeCode),
          packageRecords: nextPackageRecords,
          inventory: data.inventory.filter((item) => item.id !== `INV-${barcodeCode}`),
          batchWorkOrders: nextBatchWorkOrders,
          scheduleItems: syncScheduleItemsAfterBatchChange(data, nextBatchWorkOrders),
        });
      },
      transferToTankAction: (barcodeCode, tankCode, quantity) => {
        const data = get();
        const result = transferToTank(data, barcodeCode, tankCode, quantity);
        set({
          barcodes: data.barcodes.map((item) => item.code === result.barcode.code ? result.barcode : item),
          tanks: data.tanks.map((item) => item.code === result.tank.code ? result.tank : item),
          inventory: result.inventory,
          transferRecords: [...data.transferRecords, result.transferRecord],
        });
      },
    }),
    {
      name: 'jinyang-mes-demo',
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<MesStore>;
        const maintainedBomCode = 'BOM-PROD-A';
        const persistedHeaders = Array.isArray(persistedState.bomHeaders) ? persistedState.bomHeaders : current.bomHeaders;
        const persistedItems = Array.isArray(persistedState.bomItems) ? persistedState.bomItems : current.bomItems;
        const nextBomHeaders = [
          ...persistedHeaders.filter((item): item is BomHeader => Boolean(item && item.code && item.productCode && item.version && item.status && item.code !== maintainedBomCode)),
          ...current.bomHeaders.filter((item) => item.code === maintainedBomCode),
        ];
        const nextBomItems = [
          ...persistedItems.filter((item): item is BomItem => Boolean(item && item.id && item.bomCode && item.productCode && item.materialCode && item.materialAttr && typeof item.quantityPerUnit === 'number' && item.bomCode !== maintainedBomCode)),
          ...current.bomItems.filter((item) => item.bomCode === maintainedBomCode),
        ];
        const materialRequirements = persistedArrayOrCurrent(persistedState.materialRequirements, current.materialRequirements);
        const batchWorkOrdersRaw = persistedArrayOrCurrent(persistedState.batchWorkOrders, current.batchWorkOrders);
        const formulaSheetsRaw = persistedArrayOrCurrent(persistedState.formulaSheets, current.formulaSheets);
        const materials = normalizeMaterials((persistedState.materials ?? current.materials) as Material[]);
        const cleanedBatchArtifacts = pruneInvalidChildBatchArtifacts(
          materials,
          materialRequirements,
          persistedArrayOrCurrent(persistedState.productionOrders, current.productionOrders),
          batchWorkOrdersRaw,
          formulaSheetsRaw,
        );
        const salesOrders = normalizeSalesOrderSortOrders(sortSalesOrdersByManualOrder(
          persistedArrayOrCurrent(persistedState.salesOrders, current.salesOrders).map((order) => ({
            ...order,
            demandSource: order.demandSource ?? 'ERP',
            pushedQuantity: order.pushedQuantity ?? 0,
            remainingQuantity: order.remainingQuantity ?? order.quantity,
            productionOrderIds: order.productionOrderIds ?? [],
            kitReadyStatus: order.kitReadyStatus ?? '未评估',
            shortageLines: order.shortageLines ?? [],
          })),
        ));
        const persistedProductionOrders = persistedArrayOrCurrent(persistedState.productionOrders, current.productionOrders);
        const persistedScheduleItems = persistedArrayOrCurrent(persistedState.scheduleItems, current.scheduleItems);
        const legacyDraftScheduleItems = persistedScheduleItems.filter((item) => ((item as ScheduleItem & { locked?: boolean }).status as string | undefined) === '未下推');
        const legacyDraftByProductionOrderId = new Map(legacyDraftScheduleItems.map((item) => [item.productionOrderId, item]));
        const productionOrders = persistedProductionOrders.map((order) => {
          const legacyDraft = legacyDraftByProductionOrderId.get(order.id);
          if (legacyDraft) {
            return {
              ...order,
              status: '已排程' as const,
              lineCode: legacyDraft.lineCode,
              singlePotOutput: legacyDraft.singlePotOutput,
              singlePotWorkHours: legacyDraft.singlePotWorkHours,
              plannedStartAt: legacyDraft.startAt,
              plannedEndAt: legacyDraft.endAt,
              workHours: legacyDraft.workHours,
              cleanMinutes: legacyDraft.cleanMinutes,
              batchCount: legacyDraft.batchCount,
            };
          }
          return {
            ...order,
            status: normalizeProductionOrderStatus(order.status),
          };
        });
        const scheduleItems = syncScheduleItemStatuses(
          persistedScheduleItems
            .filter((item) => ((item as ScheduleItem & { locked?: boolean }).status as string | undefined) !== '未下推')
            .map((item) => normalizeScheduleItem(item as Parameters<typeof normalizeScheduleItem>[0])),
          cleanedBatchArtifacts.batchWorkOrders,
        );

        return {
          ...current,
          ...persistedState,
          validationBaseline: persistedState.validationBaseline ?? null,
          salesOrders,
          productionOrders,
          materialRequirements,
          inventoryReservations: normalizeInventoryReservations(persistedArrayOrCurrent(persistedState.inventoryReservations, current.inventoryReservations)),
          materialShortages: persistedArrayOrCurrent(persistedState.materialShortages, current.materialShortages),
          scheduleItems,
          batchWorkOrders: cleanedBatchArtifacts.batchWorkOrders,
          formulaSheets: cleanedBatchArtifacts.formulaSheets,
          mrpLogs: persistedArrayOrCurrent(persistedState.mrpLogs, current.mrpLogs),
          barcodes: normalizeBarcodes(persistedArrayOrCurrent(persistedState.barcodes, current.barcodes)),
          tanks: normalizeTanks(persistedArrayOrCurrent(persistedState.tanks, current.tanks)),
          executionRecords: persistedArrayOrCurrent(persistedState.executionRecords, current.executionRecords),
          feedRecords: persistedArrayOrCurrent(persistedState.feedRecords, current.feedRecords),
          packageRecords: persistedArrayOrCurrent(persistedState.packageRecords, current.packageRecords),
          transferRecords: persistedArrayOrCurrent(persistedState.transferRecords, current.transferRecords),
          lossRecords: persistedArrayOrCurrent(persistedState.lossRecords, current.lossRecords),
          scheduleRules: normalizeScheduleRules(persistedState.scheduleRules ?? current.scheduleRules),
          bomHeaders: nextBomHeaders,
          bomItems: nextBomItems,
          productionForms: persistedArrayOrCurrent(persistedState.productionForms, current.productionForms),
          productionProcesses: normalizeProductionProcesses(persistedArrayOrCurrent(persistedState.productionProcesses, current.productionProcesses)),
          productionCrafts: normalizeProductionCrafts(persistedArrayOrCurrent(persistedState.productionCrafts, current.productionCrafts)),
          mrpRule: normalizeMrpRule(persistedState.mrpRule),
          materials,
          inventory: normalizeInventoryItems(
            Array.isArray(persistedState.inventory) ? persistedState.inventory as InventoryItem[] : current.inventory,
          ),
        };
      },
    },
  ),
);
