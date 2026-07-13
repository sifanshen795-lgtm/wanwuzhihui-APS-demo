import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, message } from 'antd';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { ListPageFooter, SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { BarcodeArchive } from '../../domain/models/mes';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

type BarcodeFormValues = Omit<BarcodeArchive, 'createdAt'> & {
  createdAt?: Dayjs;
};

const inventoryStatusOptions: Array<{ value: BarcodeArchive['inventoryStatus']; label: BarcodeArchive['inventoryStatus'] }> = [
  { value: '库内', label: '库内' },
  { value: '库外', label: '库外' },
  { value: '厂外', label: '厂外' },
];

export function BarcodePage() {
  const store = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<BarcodeArchive['type']>();
  const [statusFilter, setStatusFilter] = useState<BarcodeArchive['status']>();
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<BarcodeArchive['inventoryStatus']>();
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    typeFilter: undefined as BarcodeArchive['type'] | undefined,
    statusFilter: undefined as BarcodeArchive['status'] | undefined,
    inventoryStatusFilter: undefined as BarcodeArchive['inventoryStatus'] | undefined,
  });
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<BarcodeFormValues>();

  const rows = useMemo(() => store.barcodes
    .filter((item) => !appliedFilters.keyword || `${item.code} ${item.materialCode} ${materialName(store, item.materialCode)} ${item.batchNo}`.includes(appliedFilters.keyword))
    .filter((item) => !appliedFilters.typeFilter || item.type === appliedFilters.typeFilter)
    .filter((item) => !appliedFilters.statusFilter || item.status === appliedFilters.statusFilter)
    .filter((item) => !appliedFilters.inventoryStatusFilter || (item.inventoryStatus ?? '库内') === appliedFilters.inventoryStatusFilter), [appliedFilters, store]);
  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = useMemo(() => rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [effectivePage, rows]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters]);

  const barcodeTypeOptions = [
    { value: '原料', label: '原料' },
    { value: '中间物料', label: '中间物料' },
    { value: '成品', label: '成品' },
    { value: '基准料', label: '基准料' },
  ] satisfies Array<{ value: BarcodeArchive['type']; label: string }>;

  const barcodeStatusOptions = [
    { value: '可用', label: '可用' },
    { value: '部分使用', label: '部分使用' },
    { value: '已用完', label: '已用完' },
    { value: '报废', label: '报废' },
  ] satisfies Array<{ value: BarcodeArchive['status']; label: string }>;

  const openCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `BC-${Date.now()}`,
      type: '原料',
      materialCode: store.materials[0]?.code,
      batchNo: '',
      initialQuantity: 0,
      remainingQuantity: 0,
      unit: store.materials[0]?.inventoryUnit ?? store.materials[0]?.baseUnit ?? 'kg',
      source: '手动',
      status: '可用',
      inventoryStatus: '库内',
      createdAt: dayjs(),
    });
    setOpen(true);
  };

  const openEdit = (item: BarcodeArchive) => {
    setEditingCode(item.code);
    form.setFieldsValue({
      ...item,
      inventoryStatus: item.inventoryStatus ?? '库内',
      createdAt: dayjs(item.createdAt),
    });
    setOpen(true);
  };

  const handleSearch = () => setAppliedFilters({ keyword, typeFilter, statusFilter, inventoryStatusFilter });

  const handleReset = () => {
    setKeyword('');
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setInventoryStatusFilter(undefined);
    setAppliedFilters({ keyword: '', typeFilter: undefined, statusFilter: undefined, inventoryStatusFilter: undefined });
  };

  const submit = async () => {
    const values = await form.validateFields();
    const nextBarcode: BarcodeArchive = {
      ...values,
      initialQuantity: Number(values.initialQuantity),
      remainingQuantity: Number(values.remainingQuantity),
      inventoryStatus: values.inventoryStatus,
      createdAt: values.createdAt?.toISOString() ?? new Date().toISOString(),
    };
    const duplicate = store.barcodes.some((item) => item.code === nextBarcode.code && item.code !== editingCode);
    if (duplicate) {
      message.error('条码号已存在');
      return;
    }
    useMesStore.setState((state) => ({
      barcodes: editingCode
        ? state.barcodes.map((item) => (item.code === editingCode ? nextBarcode : item))
        : [...state.barcodes, nextBarcode],
    }));
    message.success(editingCode ? '已更新条码档案' : '已新增条码档案');
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  const handleBatchDelete = () => {
    const selectedCodes = new Set(selectedRowKeys.map(String));
    useMesStore.setState((state) => ({ barcodes: state.barcodes.filter((item) => !selectedCodes.has(item.code)) }));
    setSelectedRowKeys([]);
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>条码档案</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="条码号 / 物料 / 批号" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 280 }} />
          <Select allowClear placeholder="条码类型" value={typeFilter} onChange={setTypeFilter} options={barcodeTypeOptions} style={{ width: 160 }} />
          <Select allowClear placeholder="条码状态" value={statusFilter} onChange={setStatusFilter} options={barcodeStatusOptions} style={{ width: 160 }} />
          <Select allowClear placeholder="库存状态" value={inventoryStatusFilter} onChange={setInventoryStatusFilter} options={inventoryStatusOptions} style={{ width: 160 }} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">条码档案</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" onClick={openCreate}>新增</Button>
          <Popconfirm title="确定删除选中的条码档案吗？" onConfirm={handleBatchDelete}>
            <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={pagedRows}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1450 }}
          columns={[
            { title: '条码号', dataIndex: 'code', width: 180 },
            { title: '类型', dataIndex: 'type', width: 100 },
            { title: '物料', dataIndex: 'materialCode', width: 180, render: (v) => materialName(store, v) },
            { title: '批号', dataIndex: 'batchNo', width: 180 },
            { title: '初始数量', dataIndex: 'initialQuantity', width: 100 },
            { title: '剩余数量', dataIndex: 'remainingQuantity', width: 100 },
            { title: '单位', dataIndex: 'unit', width: 80 },
            { title: '来源', dataIndex: 'source', width: 100 },
            { title: '状态', dataIndex: 'status', width: 100, render: (v) => <StatusTag value={v} /> },
            { title: '库存状态', dataIndex: 'inventoryStatus', width: 110, render: (v) => <StatusTag value={v ?? '库内'} /> },
            { title: '创建时间', dataIndex: 'createdAt', width: 220 },
            {
              title: '操作',
              width: 120,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => openEdit(row)}>编辑</Button>
                  <Popconfirm title="确定删除这条条码档案吗？" onConfirm={() => useMesStore.setState((state) => ({ barcodes: state.barcodes.filter((item) => item.code !== row.code) }))}>
                    <Button type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
        <ListPageFooter current={effectivePage} pageSize={pageSize} total={rows.length} onChange={setPage} />
      </Card>

      <Modal
        title={editingCode ? '编辑条码档案' : '新增条码档案'}
        open={open}
        onCancel={() => { setOpen(false); setEditingCode(null); form.resetFields(); }}
        onOk={submit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={900}
      >
        <Form form={form} layout="vertical">
          <Space wrap style={{ width: '100%' }}>
            <Form.Item label="条码号" name="code" rules={[{ required: true, message: '请输入条码号' }]} style={{ width: 220 }}>
              <Input disabled={Boolean(editingCode)} />
            </Form.Item>
            <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]} style={{ width: 220 }}>
              <Select options={barcodeTypeOptions} />
            </Form.Item>
            <Form.Item label="物料" name="materialCode" rules={[{ required: true, message: '请选择物料' }]} style={{ width: 220 }}>
              <Select options={store.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="批号" name="batchNo" rules={[{ required: true, message: '请输入批号' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="初始数量" name="initialQuantity" rules={[{ required: true, message: '请输入初始数量' }]} style={{ width: 220 }}>
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="剩余数量" name="remainingQuantity" rules={[{ required: true, message: '请输入剩余数量' }]} style={{ width: 220 }}>
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="来源" name="source" rules={[{ required: true, message: '请输入来源' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]} style={{ width: 220 }}>
              <Select options={barcodeStatusOptions} />
            </Form.Item>
            <Form.Item label="库存状态" name="inventoryStatus" rules={[{ required: true, message: '请选择库存状态' }]} style={{ width: 220 }}>
              <Select options={inventoryStatusOptions} />
            </Form.Item>
            <Form.Item label="创建时间" name="createdAt" rules={[{ required: true, message: '请选择创建时间' }]} style={{ width: 220 }}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
