import type {
  BarcodeStatus,
  BarcodeInventoryStatus,
  BarcodeType,
  BatchWorkOrderStatus,
  FormulaStatus,
  MaterialType,
  ProductionOrderStatus,
  ScheduleItemStatus,
  ProductionStage,
  DemandSource,
  SalesOrderStatus,
  WorkOrderType,
} from '../enums';

export interface Material {
  code: string;
  name: string;
  type: MaterialType;
  materialAttr: '自制' | '外购';
  spec?: string;
  periodDays?: number;
  baseUnit: string;
  inventoryUnit?: string;
  productionUnit?: string;
  purchaseUnit?: string;
  salesUnit?: string;
  colorGradeCode?: string;
  remark?: string;
  enabled: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface ColorGrade {
  code: string;
  name: string;
  sort: number;
}

export interface Customer {
  code: string;
  name: string;
  shortName?: string;
  type?: string;
  address?: string;
  contact?: string;
  phone?: string;
  email?: string;
  sales?: string;
  remark?: string;
  enabled: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface Unit {
  code: string;
  name: string;
  inclusionRule: string;
  precisionRule: string;
  precisionValue: number;
  remark?: string;
  enabled: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface Workshop {
  code: string;
  name: string;
}

export interface ProductionLine {
  code: string;
  name: string;
  workshopCode: string;
  stage: ProductionStage;
  enabled: boolean;
}

export interface LineProductRelation {
  productCode: string;
  productName: string;
  productSpec: string;
  lineCode: string;
  productionPriority: string;
  singlePotOutput: number;
  intervalDuration: number;
  intervalUnit: '分钟' | '小时';
  cleanDuration: number;
  cleanUnit: '分钟' | '小时';
  enabled: boolean;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface ProductIntermediateRelation {
  productCode: string;
  intermediateCode: string;
  stage: Exclude<ProductionStage, '挤出'>;
  ratio: number;
}

export interface ProductGroupRelation {
  code: string;
  name: string;
  materials: string[];
  enabled: boolean;
  remark?: string;
}

export type ProductionCalendarScope = '循环' | '不循环';
export type ProductionCalendarRecurrenceType = '每日' | '每周' | '每月';
export type ProductionCalendarSegmentType = '工作' | '休息';

export interface ProductionCalendarSegment {
  startTime: string;
  endTime: string;
  segmentType: ProductionCalendarSegmentType;
}

export interface ProductionCalendar {
  code: string;
  lineCode: string;
  scope: ProductionCalendarScope;
  recurrenceType?: ProductionCalendarRecurrenceType;
  weekdays?: number[];
  monthDays?: number[];
  effectiveFrom?: string;
  effectiveTo?: string;
  segments: ProductionCalendarSegment[];
  enabled: boolean;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface BomHeader {
  code: string;
  productCode: string;
  version: string;
  status: '草稿' | '生效' | '停用';
  isStandard: true;
  remark?: string;
  createdAt?: string;
}

export interface BomItem {
  id: string;
  bomCode: string;
  productCode: string;
  materialCode: string;
  materialAttr: '外购' | '自制';
  quantityPerUnit: number;
  feedPort?: string;
  parentId?: string;
  sortOrder?: number;
}

export type ProductionFormFieldType = 'input' | 'number' | 'radio' | 'checkbox' | 'select' | 'date' | 'upload' | 'text';

export interface ProductionFormField {
  id: string;
  type: ProductionFormFieldType;
  label: string;
  fieldCode: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
}

export interface ProductionForm {
  code: string;
  name: string;
  enabled: boolean;
  remark?: string;
  fields: ProductionFormField[];
  createdBy?: string;
  createdAt?: string;
}

export interface ProductionProcess {
  code: string;
  name: string;
  processAttr: '通用' | '包装';
  formCode?: string;
  businessDoc?: string;
  enabled: boolean;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface ProductionCraftNodeMaterial {
  id: string;
  materialCode: string;
  remark?: string;
}

export interface ProductionCraftNode {
  id: string;
  processCode: string;
  x: number;
  y: number;
  sortOrder: number;
  materials: ProductionCraftNodeMaterial[];
}

export interface ProductionCraftEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface ProductionCraft {
  code: string;
  name: string;
  materialCode: string;
  enabled: boolean;
  remark?: string;
  nodes: ProductionCraftNode[];
  edges: ProductionCraftEdge[];
  createdBy?: string;
  createdAt?: string;
}

export type MrpAutoPushMergeField = 'productCode' | 'deliveryDate' | 'customerCode' | 'demandSource' | 'unit' | 'packageRequirement';

export interface MrpRule {
  mergeSameMaterialDifferentCustomer: boolean;
  deliveryWindowDays: number;
  autoPushEnabled: boolean;
  autoPushPartialKitReady: boolean;
  autoPushMergeFields: MrpAutoPushMergeField[];
}

export type ScheduleRuleCode = 'materialReadyFirst' | 'deliveryUrgency' | 'sameProductFirst' | 'sameProductClassFirst' | 'lightToDark';

export interface ScheduleRule {
  code: ScheduleRuleCode;
  name: string;
  enabled: boolean;
  priority: number;
  remark?: string;
}

export interface SalesOrderShortageLine {
  materialCode: string;
  materialName?: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  unit: string;
}

export interface MaterialShortageSourceLine {
  salesOrderId: string;
  productCode: string;
  deliveryDate: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
}

export interface MaterialShortageSummary {
  id: string;
  mrpLogId: string;
  mrpRunTime: string;
  materialCode: string;
  materialName?: string;
  materialAttr: '外购' | '自制';
  demandDate: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  suggestedPurchaseQuantity: number;
  unit: string;
  salesOrderIds: string[];
  sourceLines: MaterialShortageSourceLine[];
}

export type KitReadyStatus = '未评估' | '齐套' | '部分齐套' | '不齐套';

export interface SalesOrder {
  id: string;
  customerCode: string;
  productCode: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  packageRequirement: string;
  demandSource: DemandSource;
  status: SalesOrderStatus;
  sortOrder: number;
  pushedQuantity: number;
  remainingQuantity: number;
  productionOrderIds: string[];
  kitReadyStatus: KitReadyStatus;
  kitReadyQuantity?: number;
  mrpFulfillmentDate?: string;
  shortageLines: SalesOrderShortageLine[];
  sourceSalesOrderId?: string;
  childSalesOrderIds?: string[];
  mergedSalesOrderIds?: string[];
  splitFromSalesOrderId?: string;
  mergedFromSalesOrderIds?: string[];
  createdAt: string;
}

export interface MrpRunLog {
  id: string;
  runTime: string;
  salesOrderIds: string[];
  productionOrderIds: string[];
  materialReady: boolean;
  result: '成功' | '失败';
  remark: string;
}

export interface ProductionOrderAllocation {
  salesOrderId: string;
  quantity: number;
}

export interface ProductionOrder {
  id: string;
  batchNo: string;
  productCode: string;
  quantity: number;
  unit: string;
  salesOrderIds: string[];
  salesOrderAllocations: ProductionOrderAllocation[];
  deliveryDate: string;
  packageRequirement: string;
  kitReadyStatus: Exclude<KitReadyStatus, '未评估'>;
  kitReadyQuantity: number;
  materialReady: boolean;
  status: ProductionOrderStatus;
  lineCode?: string;
  singlePotOutput?: number;
  singlePotWorkHours?: number;
  plannedStartAt?: string;
  plannedEndAt?: string;
  workHours?: number;
  cleanMinutes?: number;
  batchCount?: number;
  schedulePlanSource?: 'auto' | 'manual';
  scheduleReason?: string;
}

export interface MaterialRequirement {
  id: string;
  productionOrderId: string;
  rootProductCode: string;
  productCode: string;
  materialCode: string;
  materialAttr: '外购' | '自制';
  requiredQuantity: number;
  unit: string;
  feedPort?: string;
  parentRequirementId?: string;
  bomItemId?: string;
  bomLevel: number;
  bomPath: string;
  kitCheckTarget: boolean;
}

export interface ScheduleItem {
  id: string;
  productionOrderId: string;
  productCode: string;
  lineCode: string;
  startAt: string;
  endAt: string;
  batchCount: number;
  workHours: number;
  cleanMinutes: number;
  singlePotOutput: number;
  singlePotWorkHours: number;
  status: ScheduleItemStatus;
}

export interface BatchWorkOrder {
  id: string;
  batchNo: string;
  type: WorkOrderType;
  stage: ProductionStage;
  productionOrderId: string;
  parentBatchWorkOrderId?: string;
  materialCode: string;
  productionCraftCode?: string;
  plannedQuantity: number;
  unit: string;
  lineCode: string;
  plannedStartAt: string;
  plannedEndAt: string;
  status: BatchWorkOrderStatus;
}

export interface FormulaLine {
  id: string;
  materialCode: string;
  formulaQuantity: number;
  ratio: number;
  specifiedBatchNo?: string;
  specifiedBatches?: Array<{ batchNo: string }>;
  specifiedFeedPort?: string;
}

export interface FormulaSheet {
  id: string;
  batchWorkOrderId: string;
  materialCode: string;
  lines: FormulaLine[];
  status: FormulaStatus;
}

export interface BarcodeArchive {
  code: string;
  type: BarcodeType;
  materialCode: string;
  batchNo: string;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  source: string;
  status: BarcodeStatus;
  inventoryStatus: BarcodeInventoryStatus;
  createdAt: string;
}

export interface TankArchive {
  code: string;
  name: string;
  materialCode: string;
  currentQuantity: number;
  unit: string;
  lineCode?: string;
  inventoryStatus: '库外';
  enabled: boolean;
}

export type InventoryKind = '即时库存' | '预计入库' | '预计出库';
export type InventoryLocation = '仓库' | '线边仓';

export interface InventoryItem {
  id: string;
  materialCode: string;
  materialType: MaterialType;
  batchNo: string;
  plannedDate?: string;
  quantity: number;
  unit: string;
  source: 'ERP' | 'MES' | '手动' | '储罐';
  inventoryKind?: InventoryKind;
  inventoryLocation?: InventoryLocation;
  updatedAt: string;
}

export interface WorkOrderExecutionRecord {
  id: string;
  batchWorkOrderId: string;
  action: string;
  status: string;
  startAt: string;
  endAt?: string;
  actualQuantity?: number;
  remark?: string;
}

export interface FeedRecord {
  id: string;
  batchWorkOrderId: string;
  formulaSheetId: string;
  feedPort?: string;
  barcodeCode?: string;
  tankCode?: string;
  materialCode: string;
  batchNo: string;
  theoreticalQuantity: number;
  actualQuantity: number;
  remainingQuantity: number;
  fedAt: string;
}

export interface PackageRecord {
  id: string;
  batchWorkOrderId: string;
  packageNo: number;
  materialCode: string;
  weight: number;
  barcodeCode: string;
  packagedAt: string;
}

export interface TransferRecord {
  id: string;
  sourceBarcodeCode: string;
  sourceBatchNo: string;
  targetTankCode: string;
  quantity: number;
  transferredAt: string;
}

export interface LossRecord {
  id: string;
  source: '尾料损耗' | '手动创建';
  batchWorkOrderId?: string;
  barcodeCode?: string;
  materialCode: string;
  batchNo: string;
  quantity: number;
  unit: string;
  createdAt: string;
}

export type InventoryReservationStatus = '已占用' | '已释放' | '已消耗';

export interface InventoryReservation {
  id: string;
  sourceType: '生产订单';
  sourceId: string;
  materialCode: string;
  requiredQuantity: number;
  reservedQuantity: number;
  pickedQuantity?: number;
  returnedQuantity?: number;
  reservationLocation?: InventoryLocation;
  shortageQuantity: number;
  status: InventoryReservationStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface MesStateData {
  materials: Material[];
  colorGrades: ColorGrade[];
  customers: Customer[];
  units: Unit[];
  workshops: Workshop[];
  lines: ProductionLine[];
  lineProductRelations: LineProductRelation[];
  productIntermediateRelations: ProductIntermediateRelation[];
  productGroupRelations: ProductGroupRelation[];
  productionCalendars: ProductionCalendar[];
  bomHeaders: BomHeader[];
  bomItems: BomItem[];
  productionForms: ProductionForm[];
  productionProcesses: ProductionProcess[];
  productionCrafts: ProductionCraft[];
  mrpRule: MrpRule;
  scheduleRules: ScheduleRule[];
  salesOrders: SalesOrder[];
  mrpLogs: MrpRunLog[];
  productionOrders: ProductionOrder[];
  materialRequirements: MaterialRequirement[];
  scheduleItems: ScheduleItem[];
  batchWorkOrders: BatchWorkOrder[];
  formulaSheets: FormulaSheet[];
  barcodes: BarcodeArchive[];
  tanks: TankArchive[];
  inventory: InventoryItem[];
  inventoryReservations: InventoryReservation[];
  materialShortages: MaterialShortageSummary[];
  executionRecords: WorkOrderExecutionRecord[];
  feedRecords: FeedRecord[];
  packageRecords: PackageRecord[];
  transferRecords: TransferRecord[];
  lossRecords: LossRecord[];
}
