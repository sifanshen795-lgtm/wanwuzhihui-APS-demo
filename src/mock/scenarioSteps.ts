export const scenarioSteps = [
  { title: '初始化基础数据', description: '加载物料、色级、产线、BOM、库存、销售订单。' },
  { title: '执行 MRP', description: '按销售订单顺序运算齐套并自动下推：同客户同交期合并成 MO，不同客户/交期/包装拆单，部分齐套只下推可产数量，超量与草稿不生成生产订单。' },
  { title: '计划排程', description: '自动匹配挤出线，计算锅数、工时和排程时间，并输出排程单。' },
  { title: '排程输出', description: '排程单下推后，生成主产品和中间物料批次工单。' },
  { title: '审核配方', description: '配方审核通过后，现场 APP 可以执行投料。' },
  { title: 'APP 执行', description: '扫码投料、包装打码、基准料转储罐。' },
  { title: '追溯结果', description: '查看生产记录、条码档案、即时库存和储罐库存。' },
];
