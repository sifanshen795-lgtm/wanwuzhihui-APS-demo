import type { BomHeader, BomItem, LineProductRelation, Material, MesStateData, ProductIntermediateRelation, ProductionCraft, SalesOrder } from '../domain/models/mes';

const DEMO_ACTOR = '斩叶龙';
const DEMO_CREATED_AT = '2026-06-01T08:00:00.000Z';
const PAINT_POT_KG = 400;
const PAINT_POT_HOURS = 2.5;
const PAINT_CLEAN_MINUTES = 30;
const PAINT_LINES = ['LINE-EXT-01', 'LINE-EXT-02', 'LINE-EXT-03'] as const;

type CoatingSku = {
  code: string;
  name: string;
  colorGradeCode: string;
  colorCode: string;
  colorName: string;
  mixCode: string;
  mixName: string;
  keepStandardBom?: boolean;
};

const coatingSkus: CoatingSku[] = [
  { code: 'PROD-W', name: '内墙漆 · 纯白', colorGradeCode: 'CG-01', colorCode: 'INT-COLOR-W', colorName: '纯白色浆', mixCode: 'INT-MIX-W', mixName: '纯白基料' },
  { code: 'PROD-A', name: '内墙漆 · 浅灰', colorGradeCode: 'CG-02', colorCode: 'INT-COLOR-A', colorName: '浅灰色浆', mixCode: 'INT-MIX-A', mixName: '浅灰基料', keepStandardBom: true },
  { code: 'PROD-Y', name: '外墙漆 · 米黄', colorGradeCode: 'CG-03', colorCode: 'INT-COLOR-Y', colorName: '米黄色浆', mixCode: 'INT-MIX-Y', mixName: '米黄基料' },
  { code: 'PROD-D', name: '外墙漆 · 深灰', colorGradeCode: 'CG-04', colorCode: 'INT-COLOR-D', colorName: '深灰色浆', mixCode: 'INT-MIX-D', mixName: '深灰基料' },
  { code: 'PROD-K', name: '防腐漆 · 黑色', colorGradeCode: 'CG-05', colorCode: 'INT-COLOR-K', colorName: '黑色色浆', mixCode: 'INT-MIX-K', mixName: '黑色基料' },
];

const materialBase = (code: string, name: string, type: Material['type'], materialAttr: Material['materialAttr'], extra: Partial<Material> = {}): Material => ({
  code,
  name,
  type,
  materialAttr,
  periodDays: 365,
  baseUnit: 'kg',
  inventoryUnit: 'kg',
  productionUnit: 'kg',
  purchaseUnit: 'kg',
  salesUnit: 'kg',
  enabled: true,
  createdBy: DEMO_ACTOR,
  createdAt: DEMO_CREATED_AT,
  ...extra,
});

const createCoatingBom = (sku: CoatingSku): { header: BomHeader; items: BomItem[] } => {
  const bomCode = `BOM-${sku.code}`;
  const mixItemId = `${sku.code}-BOMI-002`;
  return {
    header: {
      code: bomCode,
      productCode: sku.code,
      version: 'V1',
      status: '生效',
      isStandard: true,
      remark: `${sku.name} 标准物料清单`,
      createdAt: DEMO_CREATED_AT,
    },
    items: [
      { id: `${sku.code}-BOMI-001`, bomCode, productCode: sku.code, materialCode: sku.colorCode, materialAttr: '自制', quantityPerUnit: 0.04, feedPort: 'FP-03', sortOrder: 1 },
      { id: mixItemId, bomCode, productCode: sku.code, materialCode: sku.mixCode, materialAttr: '自制', quantityPerUnit: 0.12, feedPort: 'FP-04', sortOrder: 2 },
      { id: `${sku.code}-BOMI-003`, bomCode, productCode: sku.code, materialCode: 'MAT-BASE-B', materialAttr: '外购', quantityPerUnit: 0.1, feedPort: 'TANK', sortOrder: 3 },
      { id: `${sku.code}-BOMI-004`, bomCode, productCode: sku.code, materialCode: 'MAT-PP', materialAttr: '外购', quantityPerUnit: 0.78, feedPort: 'FP-01', sortOrder: 4, parentId: mixItemId },
      { id: `${sku.code}-BOMI-005`, bomCode, productCode: sku.code, materialCode: 'MAT-AD-A', materialAttr: '外购', quantityPerUnit: 0.06, feedPort: 'FP-02', sortOrder: 5, parentId: mixItemId },
    ],
  };
};

const extraCoatingBoms = coatingSkus.filter((sku) => !sku.keepStandardBom).map(createCoatingBom);

const createDemoSalesOrder = (
  order: Pick<SalesOrder, 'id' | 'customerCode' | 'quantity' | 'deliveryDate' | 'sortOrder' | 'createdAt'>
    & Partial<Omit<SalesOrder, 'id' | 'customerCode' | 'quantity' | 'deliveryDate' | 'sortOrder' | 'createdAt'>>,
): SalesOrder => ({
  productCode: 'PROD-A',
  unit: 'kg',
  packageRequirement: '20kg/桶',
  demandSource: 'ERP',
  status: '已提交',
  pushedQuantity: 0,
  remainingQuantity: order.quantity,
  productionOrderIds: [],
  kitReadyStatus: '未评估',
  kitReadyQuantity: 0,
  shortageLines: [],
  ...order,
});

export const createSeedData = (): MesStateData => ({
  materials: [
    materialBase('MAT-PP', '丙烯酸乳液', '原料', '外购', { spec: '200kg/桶', remark: '涂料主成膜物' }),
    materialBase('MAT-AD-A', '润湿分散剂', '原料', '外购', { spec: '25kg/桶', remark: '水性助剂' }),
    materialBase('MAT-BASE-B', '钛白基准浆', '基准料', '外购', { spec: '储罐', remark: '白色基准浆' }),
    ...coatingSkus.flatMap((sku) => [
      materialBase(sku.colorCode, sku.colorName, '中间物料', '自制', { spec: '色浆', colorGradeCode: sku.colorGradeCode, remark: '调色中间物料' }),
      materialBase(sku.mixCode, sku.mixName, '中间物料', '自制', { spec: '基料', colorGradeCode: sku.colorGradeCode, remark: '配料中间物料' }),
      materialBase(sku.code, sku.name, '主产品', '自制', { spec: '20kg/桶', colorGradeCode: sku.colorGradeCode, remark: '水性涂料成品' }),
    ]),
  ],
  colorGrades: [
    { code: 'CG-01', name: '纯白', sort: 1 },
    { code: 'CG-02', name: '浅色', sort: 2 },
    { code: 'CG-03', name: '中色', sort: 3 },
    { code: 'CG-04', name: '深色', sort: 4 },
    { code: 'CG-05', name: '黑色', sort: 5 },
  ],
  customers: [
    {
      code: 'CUST-A',
      name: '华东涂装工程有限公司',
      shortName: '华东涂装',
      type: '终端客户',
      address: '上海市嘉定区涂料工业园 18 号',
      contact: '王强',
      phone: '13800000001',
      email: 'qh@example.com',
      sales: '斩叶龙',
      remark: '工程涂装客户',
      enabled: true,
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:00:00.000Z',
    },
    {
      code: 'CUST-B',
      name: '海岚精装装饰有限公司',
      shortName: '海岚精装',
      type: '渠道客户',
      address: '杭州市余杭区装饰产业园 66 号',
      contact: '李梅',
      phone: '13800000002',
      email: 'xh@example.com',
      sales: '斩叶龙',
      remark: '精装渠道客户',
      enabled: true,
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T09:00:00.000Z',
    },
    {
      code: 'CUST-C',
      name: '青禾建材连锁有限公司',
      shortName: '青禾建材',
      type: '终端客户',
      address: '苏州市吴中区建材大道 128 号',
      contact: '陈伟',
      phone: '13800000003',
      email: 'yh@example.com',
      sales: '斩叶龙',
      remark: '零售渠道客户',
      enabled: true,
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T10:00:00.000Z',
    },
  ],
  units: [
    {
      code: 'UNIT-KG',
      name: '千克',
      inclusionRule: '四舍五入',
      precisionRule: '固定小数位',
      precisionValue: 3,
      remark: '物料基础单位',
      enabled: true,
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:00:00.000Z',
    },
    {
      code: 'UNIT-BAG',
      name: '包装',
      inclusionRule: '四舍五入',
      precisionRule: '固定小数位',
      precisionValue: 3,
      remark: '包装辅助单位',
      enabled: true,
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:05:00.000Z',
    },
    {
      code: 'UNIT-POT',
      name: '锅数',
      inclusionRule: '四舍五入',
      precisionRule: '固定小数位',
      precisionValue: 3,
      remark: '产线批次单位',
      enabled: true,
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:10:00.000Z',
    },
  ],
  workshops: [{ code: 'WS-01', name: '水性涂料一车间' }],
  lines: [
    { code: 'LINE-COLOR-01', name: '调色线 01', workshopCode: 'WS-01', stage: '配色', enabled: true },
    { code: 'LINE-MIX-01', name: '配料线 01', workshopCode: 'WS-01', stage: '配料', enabled: true },
    { code: 'LINE-EXT-01', name: '调漆线 01', workshopCode: 'WS-01', stage: '挤出', enabled: true },
    { code: 'LINE-EXT-02', name: '调漆线 02', workshopCode: 'WS-01', stage: '挤出', enabled: true },
    { code: 'LINE-EXT-03', name: '调漆线 03', workshopCode: 'WS-01', stage: '挤出', enabled: true },
  ],
  lineProductRelations: [
    ...coatingSkus.flatMap((sku): LineProductRelation[] => PAINT_LINES.map((lineCode) => ({
      productCode: sku.code,
      productName: sku.name,
      productSpec: '20kg/桶',
      lineCode,
      productionPriority: '高',
      singlePotOutput: PAINT_POT_KG,
      intervalDuration: PAINT_POT_HOURS,
      intervalUnit: '小时' as const,
      cleanDuration: PAINT_CLEAN_MINUTES,
      cleanUnit: '分钟' as const,
      enabled: true,
      remark: '三条调漆线同产能，便于均衡排程',
      createdBy: DEMO_ACTOR,
      createdAt: DEMO_CREATED_AT,
    }))),
    ...coatingSkus.flatMap((sku): LineProductRelation[] => [
      {
        productCode: sku.colorCode,
        productName: sku.colorName,
        productSpec: '色浆',
        lineCode: 'LINE-COLOR-01',
        productionPriority: '高',
        singlePotOutput: 200,
        intervalDuration: 1,
        intervalUnit: '小时',
        cleanDuration: 20,
        cleanUnit: '分钟',
        enabled: true,
        remark: '色浆调色线',
        createdBy: DEMO_ACTOR,
        createdAt: DEMO_CREATED_AT,
      },
      {
        productCode: sku.mixCode,
        productName: sku.mixName,
        productSpec: '基料',
        lineCode: 'LINE-MIX-01',
        productionPriority: '高',
        singlePotOutput: 400,
        intervalDuration: 1.5,
        intervalUnit: '小时',
        cleanDuration: 20,
        cleanUnit: '分钟',
        enabled: true,
        remark: '基料配料线',
        createdBy: DEMO_ACTOR,
        createdAt: DEMO_CREATED_AT,
      },
    ]),
  ],
  productIntermediateRelations: coatingSkus.flatMap((sku): ProductIntermediateRelation[] => [
    { productCode: sku.code, intermediateCode: sku.colorCode, stage: '配色', ratio: 0.04 },
    { productCode: sku.code, intermediateCode: sku.mixCode, stage: '配料', ratio: 0.12 },
  ]),
  productGroupRelations: [
    {
      code: 'PG-01',
      name: '水性建筑涂料',
      materials: coatingSkus.flatMap((sku) => [sku.code, sku.colorCode, sku.mixCode]),
      enabled: true,
      remark: '同类涂料优先连续生产',
    },
  ],
  productionCalendars: ['LINE-COLOR-01', 'LINE-MIX-01', ...PAINT_LINES].map((lineCode, index) => ({
    code: `CAL-${lineCode}`,
    lineCode,
    scope: '循环' as const,
    recurrenceType: '每日' as const,
    segments: [{ startTime: '08:00', endTime: '20:00', segmentType: '工作' as const }],
    enabled: true,
    remark: '涂料车间白班 08:00-20:00',
    createdBy: DEMO_ACTOR,
    createdAt: `2026-06-01T08:${String(30 + index).padStart(2, '0')}:00.000Z`,
  })),
  bomHeaders: [
    { code: 'BOM-PROD-A', productCode: 'PROD-A', version: 'V1', status: '生效', isStandard: true, remark: '内墙漆 · 浅灰 标准物料清单', createdAt: '2026-06-01T08:45:00.000Z' },
    ...extraCoatingBoms.map((bom) => bom.header),
  ],
  productionForms: [
    {
      code: 'FORM-FEED',
      name: '投料记录表单',
      enabled: true,
      remark: '工序执行投料登记',
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:50:00.000Z',
      fields: [
        { id: 'FF-1', type: 'date', label: '投料日期', fieldCode: 'feedDate', required: true },
        { id: 'FF-2', type: 'number', label: '投料重量/kg', fieldCode: 'feedWeight', required: true },
        { id: 'FF-3', type: 'input', label: '投料口', fieldCode: 'feedPort', required: false },
      ],
    },
    {
      code: 'FORM-PACK',
      name: '包装记录表单',
      enabled: true,
      remark: '包装打码登记',
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:51:00.000Z',
      fields: [
        { id: 'FP-1', type: 'number', label: '包装重量/kg', fieldCode: 'packageWeight', required: true },
        { id: 'FP-2', type: 'upload', label: '包装照片', fieldCode: 'packagePhoto', required: false },
      ],
    },
    {
      code: 'FORM-COLOR',
      name: '调色过程记录表单',
      enabled: true,
      remark: '调色工序过程参数',
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T08:52:00.000Z',
      fields: [
        { id: 'FC-1', type: 'date', label: '处理日期', fieldCode: 'processDate', required: true },
        { id: 'FC-2', type: 'number', label: '处理前重量/kg', fieldCode: 'weightBefore', required: true },
        { id: 'FC-3', type: 'number', label: '处理后重量/kg', fieldCode: 'weightAfter', required: true },
        { id: 'FC-4', type: 'upload', label: '处理后称重照片', fieldCode: 'weightPhoto', required: false },
      ],
    },
  ],
  productionProcesses: [
    { code: 'PROC-COLOR', name: '调色', processAttr: '通用', formCode: 'FORM-COLOR', businessDoc: '产线运行单', enabled: true, remark: '色浆调色工序', createdBy: '斩叶龙', createdAt: '2026-06-01T08:55:00.000Z' },
    { code: 'PROC-MIX', name: '配料', processAttr: '通用', formCode: 'FORM-FEED', businessDoc: '产线运行单', enabled: true, remark: '基料配料工序', createdBy: '斩叶龙', createdAt: '2026-06-01T08:56:00.000Z' },
    { code: 'PROC-EXT', name: '调漆', processAttr: '包装', formCode: 'FORM-PACK', businessDoc: '产线运行单', enabled: true, remark: '成品调漆灌装工序', createdBy: '斩叶龙', createdAt: '2026-06-01T08:57:00.000Z' },
  ],
  productionCrafts: [
    {
      code: 'CRAFT-PROD-A',
      name: '内墙漆 · 浅灰 生产工艺',
      materialCode: 'PROD-A',
      enabled: true,
      remark: '调色 → 配料 → 调漆',
      createdBy: '斩叶龙',
      createdAt: '2026-06-01T09:00:00.000Z',
      nodes: [
        { id: 'CN-001', processCode: 'PROC-COLOR', x: 80, y: 120, sortOrder: 1, materials: [{ id: 'CM-001', materialCode: 'MAT-PP' }] },
        { id: 'CN-002', processCode: 'PROC-MIX', x: 320, y: 120, sortOrder: 2, materials: [{ id: 'CM-002', materialCode: 'MAT-AD-A' }, { id: 'CM-003', materialCode: 'MAT-BASE-B' }] },
        { id: 'CN-003', processCode: 'PROC-EXT', x: 560, y: 120, sortOrder: 3, materials: [{ id: 'CM-004', materialCode: 'INT-COLOR-A' }, { id: 'CM-005', materialCode: 'INT-MIX-A' }] },
      ],
      edges: [
        { id: 'CE-001', sourceNodeId: 'CN-001', targetNodeId: 'CN-002' },
        { id: 'CE-002', sourceNodeId: 'CN-002', targetNodeId: 'CN-003' },
      ],
    },
    ...coatingSkus.filter((sku) => sku.code !== 'PROD-A').map((sku): ProductionCraft => ({
      code: `CRAFT-${sku.code}`,
      name: `${sku.name} 生产工艺`,
      materialCode: sku.code,
      enabled: true,
      remark: '调色 → 配料 → 调漆',
      createdBy: DEMO_ACTOR,
      createdAt: DEMO_CREATED_AT,
      nodes: [
        { id: `${sku.code}-CN-001`, processCode: 'PROC-COLOR', x: 80, y: 120, sortOrder: 1, materials: [{ id: `${sku.code}-CM-001`, materialCode: 'MAT-PP' }] },
        { id: `${sku.code}-CN-002`, processCode: 'PROC-MIX', x: 320, y: 120, sortOrder: 2, materials: [{ id: `${sku.code}-CM-002`, materialCode: 'MAT-AD-A' }, { id: `${sku.code}-CM-003`, materialCode: 'MAT-BASE-B' }] },
        { id: `${sku.code}-CN-003`, processCode: 'PROC-EXT', x: 560, y: 120, sortOrder: 3, materials: [{ id: `${sku.code}-CM-004`, materialCode: sku.colorCode }, { id: `${sku.code}-CM-005`, materialCode: sku.mixCode }] },
      ],
      edges: [
        { id: `${sku.code}-CE-001`, sourceNodeId: `${sku.code}-CN-001`, targetNodeId: `${sku.code}-CN-002` },
        { id: `${sku.code}-CE-002`, sourceNodeId: `${sku.code}-CN-002`, targetNodeId: `${sku.code}-CN-003` },
      ],
    })),
  ],
  bomItems: [
    { id: 'BOMI-001', bomCode: 'BOM-PROD-A', productCode: 'PROD-A', materialCode: 'INT-COLOR-A', materialAttr: '自制', quantityPerUnit: 0.04, feedPort: 'FP-03', sortOrder: 1 },
    { id: 'BOMI-002', bomCode: 'BOM-PROD-A', productCode: 'PROD-A', materialCode: 'INT-MIX-A', materialAttr: '自制', quantityPerUnit: 0.12, feedPort: 'FP-04', sortOrder: 2 },
    { id: 'BOMI-003', bomCode: 'BOM-PROD-A', productCode: 'PROD-A', materialCode: 'MAT-BASE-B', materialAttr: '外购', quantityPerUnit: 0.1, feedPort: 'TANK', sortOrder: 3 },
    { id: 'BOMI-004', bomCode: 'BOM-PROD-A', productCode: 'PROD-A', materialCode: 'MAT-PP', materialAttr: '外购', quantityPerUnit: 0.78, feedPort: 'FP-01', sortOrder: 4, parentId: 'BOMI-002' },
    { id: 'BOMI-005', bomCode: 'BOM-PROD-A', productCode: 'PROD-A', materialCode: 'MAT-AD-A', materialAttr: '外购', quantityPerUnit: 0.06, feedPort: 'FP-02', sortOrder: 5, parentId: 'BOMI-002' },
    ...extraCoatingBoms.flatMap((bom) => bom.items),
  ],
  mrpRule: {
    mergeSameMaterialDifferentCustomer: true,
    deliveryWindowDays: 3,
    autoPushEnabled: true,
    autoPushPartialKitReady: true,
    autoPushMergeFields: ['productCode', 'deliveryDate', 'customerCode', 'demandSource', 'unit', 'packageRequirement'],
  },
  scheduleRules: [
    { code: 'materialReadyFirst', name: '物料已齐套优先生产', enabled: true, priority: 1, remark: '齐套订单优先进入排程，不排除未齐套订单' },
    { code: 'deliveryUrgency', name: '根据交期紧急程度生产', enabled: true, priority: 2, remark: '交期越早越优先' },
    { code: 'sameProductFirst', name: '相同产品优先生产', enabled: true, priority: 3, remark: '相同产品尽量连续生产' },
    { code: 'sameProductClassFirst', name: '同类产品优先生产', enabled: true, priority: 4, remark: '按产品组关系表归类，未配置产品组时按产品编码兜底' },
    { code: 'lightToDark', name: '由浅至深生产', enabled: true, priority: 5, remark: '按色级排序从浅到深' },
  ],
  salesOrders: [
    createDemoSalesOrder({ id: 'SO001', customerCode: 'CUST-A', productCode: 'PROD-W', quantity: 800, deliveryDate: '2026-10-16', sortOrder: 1, createdAt: '2026-10-12T09:00:00.000Z' }),
    createDemoSalesOrder({ id: 'SO002', customerCode: 'CUST-B', productCode: 'PROD-A', quantity: 800, deliveryDate: '2026-10-16', sortOrder: 2, createdAt: '2026-10-12T09:10:00.000Z' }),
    createDemoSalesOrder({ id: 'SO003', customerCode: 'CUST-C', productCode: 'PROD-Y', quantity: 800, deliveryDate: '2026-10-16', sortOrder: 3, createdAt: '2026-10-12T09:20:00.000Z' }),
    createDemoSalesOrder({ id: 'SO004', customerCode: 'CUST-A', productCode: 'PROD-D', quantity: 800, deliveryDate: '2026-10-16', sortOrder: 4, createdAt: '2026-10-12T09:30:00.000Z' }),
    createDemoSalesOrder({ id: 'SO005', customerCode: 'CUST-B', productCode: 'PROD-K', quantity: 800, deliveryDate: '2026-10-16', sortOrder: 5, createdAt: '2026-10-12T09:40:00.000Z' }),
    createDemoSalesOrder({ id: 'SO006', customerCode: 'CUST-C', productCode: 'PROD-W', quantity: 800, deliveryDate: '2026-10-17', sortOrder: 6, createdAt: '2026-10-12T09:50:00.000Z' }),
    createDemoSalesOrder({ id: 'SO007', customerCode: 'CUST-A', productCode: 'PROD-Y', quantity: 400, deliveryDate: '2026-10-24', demandSource: '预测', status: '草稿', sortOrder: 7, createdAt: '2026-10-12T10:00:00.000Z' }),
  ],
  mrpLogs: [],
  productionOrders: [],
  materialRequirements: [],
  scheduleItems: [],
  batchWorkOrders: [],
  formulaSheets: [],
  barcodes: [
    { code: 'BC-PP-001', type: '原料', materialCode: 'MAT-PP', batchNo: 'PP20260601', initialQuantity: 290, remainingQuantity: 290, unit: 'kg', source: 'ERP', status: '可用', inventoryStatus: '库内', createdAt: '2026-06-01T08:00:00.000Z' },
    { code: 'BC-AD-001', type: '原料', materialCode: 'MAT-AD-A', batchNo: 'AD20260601', initialQuantity: 25, remainingQuantity: 25, unit: 'kg', source: 'ERP', status: '可用', inventoryStatus: '库内', createdAt: '2026-06-01T08:00:00.000Z' },
    { code: 'BC-BASE-001', type: '基准料', materialCode: 'MAT-BASE-B', batchNo: 'BASE20260601', initialQuantity: 300, remainingQuantity: 300, unit: 'kg', source: 'ERP', status: '可用', inventoryStatus: '库内', createdAt: '2026-06-01T08:00:00.000Z' },
    { code: 'BC-COLOR-001', type: '中间物料', materialCode: 'INT-COLOR-A', batchNo: 'COLOR20260601', initialQuantity: 120, remainingQuantity: 120, unit: 'kg', source: 'MES', status: '可用', inventoryStatus: '库内', createdAt: '2026-06-01T08:00:00.000Z' },
    ...coatingSkus.filter((sku) => sku.colorCode !== 'INT-COLOR-A').map((sku) => ({
      code: `BC-${sku.colorCode}`,
      type: '中间物料' as const,
      materialCode: sku.colorCode,
      batchNo: `${sku.colorCode}-20261012`,
      initialQuantity: 80,
      remainingQuantity: 80,
      unit: 'kg',
      source: 'MES' as const,
      status: '可用' as const,
      inventoryStatus: '库内' as const,
      createdAt: '2026-10-12T08:00:00.000Z',
    })),
  ],
  tanks: [{ code: 'TANK-01', name: '钛白基准浆储罐 01', materialCode: 'MAT-BASE-B', currentQuantity: 300, unit: 'kg', lineCode: 'LINE-EXT-01', inventoryStatus: '库外', enabled: true }],
  inventory: [
    { id: 'INV-BASE-B', materialCode: 'MAT-BASE-B', materialType: '基准料', batchNo: '', quantity: 300, unit: 'kg', source: '储罐', inventoryKind: '即时库存', inventoryLocation: '仓库', updatedAt: '2026-06-01T08:00:00.000Z' },
    { id: 'INV-AD-A', materialCode: 'MAT-AD-A', materialType: '原料', batchNo: '', quantity: 25, unit: 'kg', source: 'ERP', inventoryKind: '即时库存', inventoryLocation: '仓库', updatedAt: '2026-06-01T08:00:00.000Z' },
    { id: 'INV-PP', materialCode: 'MAT-PP', materialType: '原料', batchNo: '', quantity: 290, unit: 'kg', source: 'ERP', inventoryKind: '即时库存', inventoryLocation: '仓库', updatedAt: '2026-06-01T08:00:00.000Z' },
    { id: 'INV-COLOR-A', materialCode: 'INT-COLOR-A', materialType: '中间物料', batchNo: '', quantity: 120, unit: 'kg', source: 'MES', inventoryKind: '即时库存', inventoryLocation: '仓库', updatedAt: '2026-06-01T08:00:00.000Z' },
    ...coatingSkus.filter((sku) => sku.colorCode !== 'INT-COLOR-A').map((sku) => ({
      id: `INV-${sku.colorCode}`,
      materialCode: sku.colorCode,
      materialType: '中间物料' as const,
      batchNo: '',
      quantity: 80,
      unit: 'kg',
      source: 'MES' as const,
      inventoryKind: '即时库存' as const,
      inventoryLocation: '仓库' as const,
      updatedAt: '2026-10-12T08:00:00.000Z',
    })),
    { id: 'INV-PLAN-COLOR-A', materialCode: 'INT-COLOR-A', materialType: '中间物料', batchNo: 'COLOR20261014', plannedDate: '2026-10-14', quantity: 80, unit: 'kg', source: 'ERP', inventoryKind: '预计入库', inventoryLocation: '仓库', updatedAt: '2026-10-12T08:00:00.000Z' },
    { id: 'INV-PLAN-PP', materialCode: 'MAT-PP', materialType: '原料', batchNo: 'PP20261014', plannedDate: '2026-10-14', quantity: 200, unit: 'kg', source: 'ERP', inventoryKind: '预计入库', inventoryLocation: '仓库', updatedAt: '2026-10-12T08:00:00.000Z' },
    { id: 'INV-PLAN-AD-A', materialCode: 'MAT-AD-A', materialType: '原料', batchNo: 'AD20261014', plannedDate: '2026-10-14', quantity: 20, unit: 'kg', source: 'ERP', inventoryKind: '预计入库', inventoryLocation: '仓库', updatedAt: '2026-10-12T08:00:00.000Z' },
  ],
  inventoryReservations: [],
  materialShortages: [],
  executionRecords: [],
  feedRecords: [],
  packageRecords: [],
  transferRecords: [],
  lossRecords: [],
});
