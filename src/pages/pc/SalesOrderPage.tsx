import { Button, Card, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { ListPageFooter, SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import { useMesStore } from '../../store/useMesStore';
import { customerName, materialName } from '../../utils/display';
import { formatProductionOrderKitText, formatSalesOrderKitText, salesOrderKitStatusColor, salesOrderKitStatusLabel } from '../../utils/kitDisplay';
type SalesOrderRow = {
  id: string;
  customerCode: string;
  productCode: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  packageRequirement: string;
  demandSource: 'ERP' | '手工' | '预测' | '补单';
  status: string;
  sortOrder: number;
  pushedQuantity: number;
  remainingQuantity: number;
  productionOrderIds: string[];
  kitReadyStatus: '未评估' | '齐套' | '部分齐套' | '不齐套';
  kitReadyQuantity?: number;
  mrpFulfillmentDate?: string;
  kitReadyText: string;
  shortageLines: Array<{ materialCode: string; materialName?: string; requiredQuantity: number; availableQuantity: number; shortageQuantity: number; unit: string }>;
  sourceSalesOrderId?: string;
  childSalesOrderIds?: string[];
  mergedSalesOrderIds?: string[];
  splitFromSalesOrderId?: string;
  mergedFromSalesOrderIds?: string[];
  createdAt: string;
  shortageSummary: string;
  mrpFulfillmentText: string;
};

export function SalesOrderPage() {
  const store = useMesStore();
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'shortage' | 'mo' | null>(null);
  const [detailRow, setDetailRow] = useState<SalesOrderRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();
  const [splitForm] = Form.useForm();
  const [mergeForm] = Form.useForm();

  const filters = Form.useWatch([], form) ?? {};

  const rows = useMemo(() => {
    const keyword = String(filters.keyword ?? '').trim();
    return [...store.salesOrders]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.deliveryDate.localeCompare(b.deliveryDate) || a.id.localeCompare(b.id))
      .map((row) => {
        const shortageLines = row.shortageLines ?? [];
        const pushedQuantity = row.pushedQuantity ?? 0;
        const remainingQuantity = row.remainingQuantity ?? row.quantity;
        const productionOrderIds = row.productionOrderIds ?? [];
        const kitReadyQuantity = row.kitReadyStatus === '未评估'
          ? 0
          : Math.min(row.kitReadyQuantity ?? 0, row.quantity);
        const kitReadyText = formatSalesOrderKitText(row.kitReadyStatus, kitReadyQuantity, row.quantity);
        const mrpFulfillmentText = row.kitReadyStatus === '未评估'
          ? '未评估'
          : kitReadyQuantity <= 0
            ? '预计缺料'
            : row.mrpFulfillmentDate === '当前'
              ? '当前可满足'
              : row.mrpFulfillmentDate
                ? `预计 ${row.mrpFulfillmentDate}`
                : '预计缺料';
        return {
          ...row,
          shortageLines,
          pushedQuantity,
          remainingQuantity,
          productionOrderIds,
          kitReadyText,
          mrpFulfillmentText,
          shortageSummary: shortageLines.length ? `缺 ${shortageLines.length} 项` : '无缺料',
        };
      })
      .filter((row) => !filters.status || row.status === filters.status)
      .filter((row) => !filters.kitReadyStatus || row.kitReadyStatus === filters.kitReadyStatus)
      .filter((row) => !keyword || [row.id, row.customerCode, row.productCode].join(' ').includes(keyword));
  }, [filters.kitReadyStatus, filters.keyword, filters.status, store.salesOrders]) as SalesOrderRow[];
  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = useMemo(() => rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [effectivePage, rows]);
  const selectedRows = useMemo(() => rows.filter((row) => selected.includes(row.id)), [rows, selected]);
  const selectedHasZeroRemaining = selectedRows.some((row) => (row.remainingQuantity ?? row.quantity) <= 0);

  useEffect(() => {
    setPage(1);
  }, [filters.kitReadyStatus, filters.keyword, filters.status]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      status: '草稿',
      unit: 'kg',
      quantity: 1000,
      deliveryDate: dayjs().add(7, 'day'),
      demandSource: 'ERP',
    });
    setOpen(true);
  };

  const openEdit = (row: typeof rows[number]) => {
    setEditingId(row.id);
    form.setFieldsValue({
      ...row,
      deliveryDate: dayjs(row.deliveryDate),
    });
    setOpen(true);
  };

  const saveOrder = () => {
    const values = form.getFieldsValue();
    const nextSortOrder = editingId ? rows.find((item) => item.id === editingId)?.sortOrder ?? rows.length + 1 : rows.length + 1;
    const payload = {
      id: values.id,
      customerCode: values.customerCode,
      productCode: values.productCode,
      quantity: Number(values.quantity),
      unit: values.unit,
      deliveryDate: values.deliveryDate?.format('YYYY-MM-DD') ?? '',
      packageRequirement: values.packageRequirement,
      demandSource: values.demandSource ?? 'ERP',
      status: '已提交' as const,
      sortOrder: nextSortOrder,
      pushedQuantity: 0,
      remainingQuantity: Number(values.quantity),
      productionOrderIds: [],
      kitReadyStatus: editingId ? (rows.find((item) => item.id === editingId)?.kitReadyStatus ?? '未评估') : '未评估',
      kitReadyQuantity: editingId ? (rows.find((item) => item.id === editingId)?.kitReadyQuantity ?? 0) : 0,
      shortageLines: editingId ? (rows.find((item) => item.id === editingId)?.shortageLines ?? []) : [],
      createdAt: editingId ? (rows.find((item) => item.id === editingId)?.createdAt ?? dayjs().toISOString()) : dayjs().toISOString(),
    };
    if (editingId) {
      store.editSalesOrderAction(editingId, payload);
      message.success('已更新销售订单');
    } else {
      store.addSalesOrderAction(payload);
      message.success('已新增销售订单');
    }
    setOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const runMrp = () => {
    try {
      store.runMrpForOrders();
      message.success('MRP 运算完成，已自动生成可齐套的生产订单');
      setSelected([]);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const moveRow = (fromIndex: number, toIndex: number) => {
    const next = [...rows];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    store.reorderSalesOrdersAction(next.map((item) => item.id));
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ordered = [...rows.map((item) => item.id)];
    const fromIndex = ordered.indexOf(dragId);
    const toIndex = ordered.indexOf(targetId);
    ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, dragId);
    store.reorderSalesOrdersAction(ordered);
    setDragId(null);
  };

  const openSplit = (row: typeof rows[number]) => {
    splitForm.resetFields();
    splitForm.setFieldsValue({
      sourceId: row.id,
      splitLines: [{ quantity: Math.max(1, row.remainingQuantity ?? row.quantity), deliveryDate: dayjs(row.deliveryDate) }],
    });
    setSplitOpen(true);
  };

  const submitSplit = () => {
    const values = splitForm.getFieldsValue();
    const lines = (values.splitLines ?? []).map((item: { quantity?: number | string; deliveryDate?: dayjs.Dayjs }) => ({
      quantity: Number(item.quantity ?? 0),
      deliveryDate: item.deliveryDate?.format('YYYY-MM-DD') ?? '',
    })).filter((item: { quantity: number; deliveryDate: string }) => item.quantity > 0);
    if (!lines.length) {
      message.error('请至少填写一行下推明细');
      return;
    }
    store.splitSalesOrderAction(values.sourceId, lines);
    setSplitOpen(false);
  };

  const openDetail = (row: (typeof rows)[number], type: 'shortage' | 'mo') => {
    setDetailRow(row);
    setDetailType(type);
    setDetailOpen(true);
  };

  const openMerge = () => {
    mergeForm.resetFields();
    const sourceOrders = rows.filter((item) => selected.includes(item.id));
    const earliestDeliveryDate = [...sourceOrders.map((item) => item.deliveryDate)].sort()[0];
    mergeForm.setFieldsValue({
      salesOrderIds: selected,
      deliveryDate: earliestDeliveryDate ? dayjs(earliestDeliveryDate) : undefined,
      packageRequirement: sourceOrders[0]?.packageRequirement,
    });
    setMergeOpen(true);
  };

  const submitMerge = () => {
    const values = mergeForm.getFieldsValue();
    const sourceOrders = store.salesOrders.filter((item) => (values.salesOrderIds ?? []).includes(item.id));
    if (!sourceOrders.length) {
      message.error('请选择要执行 MRP 的销售订单');
      return;
    }
    store.mergeSalesOrdersAction(values.salesOrderIds, {
      id: '',
      customerCode: sourceOrders[0].customerCode,
      productCode: sourceOrders[0].productCode,
      quantity: sourceOrders.reduce((sum, item) => sum + (item.remainingQuantity ?? item.quantity), 0),
      unit: sourceOrders[0].unit,
      deliveryDate: values.deliveryDate?.format('YYYY-MM-DD') ?? sourceOrders[0].deliveryDate,
      packageRequirement: values.packageRequirement ?? sourceOrders[0].packageRequirement,
    });
    setMergeOpen(false);
    setSelected([]);
  };

  const detailProductionOrders = detailRow ? store.productionOrders.filter((item) => detailRow.productionOrderIds.includes(item.id)) : [];
  const detailTitle = detailType === 'shortage' ? '查看缺料' : '查看 MO';

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: '拖拽',
      key: 'drag',
      width: 80,
      render: (_, row, index) => (
        <span
          draggable
          onDragStart={() => handleDragStart(row.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(row.id)}
          style={{ cursor: 'move', display: 'inline-flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
        >
          <span>⋮⋮</span>
          <span>{(effectivePage - 1) * pageSize + index + 1}</span>
        </span>
      ),
    },
    { title: '订单编号', dataIndex: 'id', width: 140 },
    { title: '物料', dataIndex: 'productCode', width: 180, render: (v) => materialName(store, v) },
    { title: '销售数量', dataIndex: 'quantity', width: 120 },
    { title: '已下推数量', dataIndex: 'pushedQuantity', width: 120 },
    { title: '剩余数量', dataIndex: 'remainingQuantity', width: 120 },
    { title: '基本单位', dataIndex: 'unit', width: 100 },
    { title: '客户', dataIndex: 'customerCode', width: 220, render: (v) => customerName(store, v) },
    { title: '包装要求', dataIndex: 'packageRequirement', width: 140, render: (v) => v || '-' },
    { title: '业务来源', dataIndex: 'demandSource', width: 120 },
    { title: '要货日期', dataIndex: 'deliveryDate', width: 120 },
    { title: 'MRP可满足', dataIndex: 'kitReadyStatus', width: 200, render: (_, row) => <Tag color={salesOrderKitStatusColor(row.kitReadyStatus)}>{row.kitReadyText}</Tag> },
    { title: '预计满足日期', dataIndex: 'mrpFulfillmentText', width: 150 },
    { title: '缺料情况', dataIndex: 'shortageSummary', width: 140, render: (v, row) => row.shortageLines.length ? <Tag color="orange">{v}</Tag> : <Tag color="green">无缺料</Tag> },
    { title: '关联 MO', dataIndex: 'productionOrderIds', width: 180, render: (v) => v.length ? v.join(', ') : '-' },
    {
      title: '操作',
      width: 300,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => openEdit(row)}>编辑</Button>
          <Button type="link" disabled={(row.remainingQuantity ?? row.quantity) <= 0} onClick={() => openSplit(row)}>拆分下推</Button>
          <Popconfirm title="确定删除这条订单吗？" onConfirm={() => store.deleteSalesOrderAction(row.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
          {row.shortageLines.length > 0 && <Button type="link" onClick={() => openDetail(row, 'shortage')}>查看缺料</Button>}
          {row.productionOrderIds.length > 0 && <Button type="link" onClick={() => openDetail(row, 'mo')}>查看 MO</Button>}
          {row.status !== '已关闭' && <Button type="link" danger onClick={() => store.closeSalesOrderAction(row.id)}>关闭</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-title">
        <h2>销售订单</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input placeholder="关键字：订单号 / 客户 / 物料" style={{ width: 320 }} onChange={(e) => form.setFieldValue('keyword', e.target.value)} />
          <Select allowClear placeholder="状态" style={{ width: 180 }} options={[{ value: '草稿', label: '草稿' }, { value: '已提交', label: '已提交' }, { value: '已关闭', label: '已关闭' }]} onChange={(value) => form.setFieldValue('status', value)} />
          <Select allowClear placeholder="MRP可满足" style={{ width: 200 }} options={Object.entries(salesOrderKitStatusLabel).map(([value, label]) => ({ value, label }))} onChange={(value) => form.setFieldValue('kitReadyStatus', value)} />
          <Button type="primary">查询</Button>
          <Button onClick={() => form.resetFields()}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">数据列表</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selected.length} />
          <Button type="primary" onClick={openCreate}>手工新增</Button>
          <Button onClick={() => {
            try {
              store.pushSalesOrdersToProductionOrdersAction(selected.map(String));
              message.success('已下推生产订单');
              setSelected([]);
            } catch (e) {
              message.error((e as Error).message);
            }
          }} disabled={!selected.length || selectedHasZeroRemaining}>下推生产订单</Button>
          <Button onClick={openMerge} disabled={!selected.length || selectedHasZeroRemaining}>合并下推</Button>
          <Button disabled={!rows.some((row) => row.status === '已提交')} onClick={runMrp}>全量 MRP</Button>
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={pagedRows}
          pagination={false}
          scroll={{ x: 1900 }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys),
            getCheckboxProps: (row) => ({ disabled: row.status === '已关闭' }),
          }}
          columns={columns}
          expandable={{
            expandedRowRender: (row) => (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>缺料明细</div>
                {row.shortageLines.length ? (
                  <Table
                    pagination={false}
                    size="small"
                    rowKey={(item) => `${row.id}-${item.materialCode}`}
                    dataSource={row.shortageLines}
                    columns={[
                      { title: '物料', dataIndex: 'materialCode', render: (v, item) => item.materialName ? `${item.materialCode} - ${item.materialName}` : v },
                      { title: '需求量', dataIndex: 'requiredQuantity' },
                      { title: '可用量', dataIndex: 'availableQuantity' },
                      { title: '缺料量', dataIndex: 'shortageQuantity' },
                      { title: '单位', dataIndex: 'unit' },
                    ]}
                  />
                ) : (
                  <Tag color="green">当前订单无缺料</Tag>
                )}
              </div>
            ),
          }}
        />
        <ListPageFooter
          note="MRP可满足按即时库存 + 预计入库评估，不锁库存；预计满足日期表示当前或所需预计入库最晚日期；下推后以生产订单库存齐套和MRP库存占用单为准。"
          current={effectivePage}
          pageSize={pageSize}
          total={rows.length}
          onChange={setPage}
        />
      </Card>

      <Modal
        title={editingId ? '编辑销售订单' : '新增销售订单'}
        open={open}
        onCancel={() => { setOpen(false); setEditingId(null); form.resetFields(); }}
        onOk={saveOrder}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={980}
      >
        <Form form={form} layout="vertical">
          <Space wrap style={{ width: '100%' }}>
            <Form.Item label="订单编号" name="id" rules={[{ required: true, message: '请输入订单编号' }]} style={{ width: 220 }}>
              <Input placeholder="输入唯一编号" disabled={Boolean(editingId)} />
            </Form.Item>
            <Form.Item label="客户" name="customerCode" rules={[{ required: true, message: '请选择客户' }]} style={{ width: 220 }}>
              <Select options={store.customers.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="物料" name="productCode" rules={[{ required: true, message: '请选择物料' }]} style={{ width: 220 }}>
              <Select options={store.materials.filter((item) => item.type === '主产品').map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="销售数量" name="quantity" rules={[{ required: true, message: '请输入销售数量' }]} style={{ width: 220 }}>
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item label="基本单位" name="unit" rules={[{ required: true, message: '请输入基本单位' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="要货日期" name="deliveryDate" rules={[{ required: true, message: '请选择要货日期' }]} style={{ width: 220 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="包装要求" name="packageRequirement" style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="业务来源" name="demandSource" rules={[{ required: true, message: '请选择业务来源' }]} style={{ width: 220 }}>
              <Select options={[{ value: 'ERP', label: 'ERP' }, { value: '手工', label: '手工' }, { value: '预测', label: '预测' }, { value: '补单', label: '补单' }]} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="拆分下推"
        open={splitOpen}
        onCancel={() => { setSplitOpen(false); splitForm.resetFields(); }}
        onOk={submitSplit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={900}
      >
        <Form form={splitForm} layout="vertical">
          <Space wrap style={{ width: '100%' }}>
            <Form.Item label="来源订单" name="sourceId" style={{ width: 220 }}>
              <Input disabled />
            </Form.Item>
          </Space>
          <Form.List name="splitLines">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <Space key={field.key} wrap align="start" style={{ width: '100%' }}>
                    <Form.Item label={`生产订单${index + 1}数量`} name={[field.name, 'quantity']} rules={[{ required: true, message: '请输入下推数量' }]} style={{ width: 220 }}>
                      <Input type="number" min={1} />
                    </Form.Item>
                    <Form.Item label="生产订单交期" name={[field.name, 'deliveryDate']} rules={[{ required: true, message: '请选择生产订单交期' }]} style={{ width: 220 }}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Button danger type="link" disabled={fields.length <= 1} onClick={() => remove(field.name)} style={{ marginTop: 30 }}>删除</Button>
                  </Space>
                ))}
                <Button onClick={() => add({ quantity: 1, deliveryDate: dayjs() })}>新增生产订单</Button>
              </Space>
            )}
          </Form.List>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            每行生成一张生产订单，未下推的剩余数量继续保留在销售订单。
          </div>
        </Form>
      </Modal>

      <Modal
        title="合并下推"
        open={mergeOpen}
        onCancel={() => { setMergeOpen(false); mergeForm.resetFields(); }}
        onOk={submitMerge}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={900}
      >
        <Form form={mergeForm} layout="vertical">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item label="待合并订单" name="salesOrderIds" style={{ width: 420 }}>
              <Select disabled mode="multiple" options={store.salesOrders.map((item) => ({ value: item.id, label: `${item.id} - ${materialName(store, item.productCode)}` }))} />
            </Form.Item>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={rows.filter((item) => selected.includes(item.id))}
              columns={[
                { title: '订单编号', dataIndex: 'id', width: 140 },
                { title: '物料', dataIndex: 'productCode', width: 180, render: (value) => materialName(store, value) },
                { title: '剩余数量', dataIndex: 'remainingQuantity', width: 120 },
                { title: '单位', dataIndex: 'unit', width: 80 },
                { title: '要货日期', dataIndex: 'deliveryDate', width: 120 },
              ]}
            />
            <Space wrap style={{ width: '100%' }}>
              <Form.Item label="合并数量" style={{ width: 220 }}>
                <Input disabled value={rows.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + (item.remainingQuantity ?? item.quantity), 0)} />
              </Form.Item>
              <Form.Item label="生产订单交期" name="deliveryDate" rules={[{ required: true, message: '请选择生产订单交期' }]} style={{ width: 220 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="包装要求" name="packageRequirement" style={{ width: 220 }}>
                <Input />
              </Form.Item>
            </Space>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              所选销售订单的剩余数量将合并生成一张生产订单；未选订单不参与下推。
            </div>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={detailTitle}
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailRow(null); setDetailType(null); }}
        footer={null}
        destroyOnClose
        width={980}
      >
        {detailRow && detailType === 'shortage' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ fontWeight: 600 }}>订单 {detailRow.id} 的缺料明细</div>
            {detailRow.shortageLines.length ? (
              <Table
                rowKey={(item) => `${detailRow.id}-${item.materialCode}`}
                pagination={false}
                size="small"
                dataSource={detailRow.shortageLines}
                columns={[
                  { title: '物料', dataIndex: 'materialCode', render: (v, item) => item.materialName ? `${item.materialCode} - ${item.materialName}` : v },
                  { title: '需求量', dataIndex: 'requiredQuantity' },
                  { title: '可用量', dataIndex: 'availableQuantity' },
                  { title: '缺料量', dataIndex: 'shortageQuantity' },
                  { title: '单位', dataIndex: 'unit' },
                ]}
              />
            ) : (
              <Empty description="当前订单没有缺料" />
            )}
          </Space>
        )}

        {detailRow && detailType === 'mo' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ fontWeight: 600 }}>订单 {detailRow.id} 关联的 MO</div>
            {detailProductionOrders.length ? (
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                dataSource={detailProductionOrders}
                expandable={{
                  expandedRowRender: (row) => (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ fontWeight: 600 }}>销售订单分配明细</div>
                      <Space wrap>
                        {row.salesOrderAllocations.map((item) => <Tag key={item.salesOrderId}>{item.salesOrderId} × {item.quantity}</Tag>)}
                      </Space>
                    </Space>
                  ),
                }}
                columns={[
                  { title: 'MO 单号', dataIndex: 'id' },
                  { title: '主产品', dataIndex: 'productCode', render: (v) => materialName(store, v) },
                  { title: '数量', dataIndex: 'quantity' },
                  { title: '交期', dataIndex: 'deliveryDate' },
                  {
                    title: '库存齐套',
                    dataIndex: 'kitReadyStatus',
                    render: (_, row) => {
                      const kitReadyQuantity = row.kitReadyQuantity ?? 0;
                      return <Tag color={row.kitReadyStatus === '齐套' ? 'green' : row.kitReadyStatus === '部分齐套' ? 'orange' : 'red'}>{formatProductionOrderKitText(row.kitReadyStatus, kitReadyQuantity, row.quantity)}</Tag>;
                    },
                  },
                  { title: '状态', dataIndex: 'status' },
                ]}
              />
            ) : (
              <Empty description="当前订单没有关联 MO" />
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
