import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ListPageFooter, SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import type { TankArchive } from '../../domain/models/mes';
import { useMesStore } from '../../store/useMesStore';
import { lineName, materialName } from '../../utils/display';

export function TankPage() {
  const store = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>();
  const [lineFilter, setLineFilter] = useState<string>();
  const [enabledFilter, setEnabledFilter] = useState<boolean>();
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    materialFilter: undefined as string | undefined,
    lineFilter: undefined as string | undefined,
    enabledFilter: undefined as boolean | undefined,
  });
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<TankArchive>();

  const rows = useMemo(() => store.tanks
    .filter((item) => !appliedFilters.keyword || `${item.code} ${item.name}`.includes(appliedFilters.keyword))
    .filter((item) => !appliedFilters.materialFilter || item.materialCode === appliedFilters.materialFilter)
    .filter((item) => !appliedFilters.lineFilter || item.lineCode === appliedFilters.lineFilter)
    .filter((item) => appliedFilters.enabledFilter === undefined || item.enabled === appliedFilters.enabledFilter), [appliedFilters, store.tanks]);
  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = useMemo(() => rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [effectivePage, rows]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters]);

  const openCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `TANK-${String(store.tanks.length + 1).padStart(2, '0')}`,
      name: '',
      materialCode: store.materials[0]?.code,
      currentQuantity: 0,
      unit: store.materials[0]?.inventoryUnit ?? store.materials[0]?.baseUnit ?? 'kg',
      lineCode: store.lines[0]?.code,
      inventoryStatus: '库外',
      enabled: true,
    });
    setOpen(true);
  };

  const openEdit = (tank: TankArchive) => {
    setEditingCode(tank.code);
    form.setFieldsValue({ ...tank, inventoryStatus: '库外' });
    setOpen(true);
  };

  const handleSearch = () => setAppliedFilters({ keyword, materialFilter, lineFilter, enabledFilter });
  const handleReset = () => {
    setKeyword('');
    setMaterialFilter(undefined);
    setLineFilter(undefined);
    setEnabledFilter(undefined);
    setAppliedFilters({ keyword: '', materialFilter: undefined, lineFilter: undefined, enabledFilter: undefined });
  };

  const submit = async () => {
    const values = await form.validateFields();
    const nextTank: TankArchive = {
      ...values,
      currentQuantity: Number(values.currentQuantity),
      inventoryStatus: '库外',
    };
    const duplicate = store.tanks.some((item) => item.code === nextTank.code && item.code !== editingCode);
    if (duplicate) {
      message.error('储罐编码已存在');
      return;
    }
    useMesStore.setState((state) => ({
      tanks: editingCode
        ? state.tanks.map((item) => (item.code === editingCode ? nextTank : item))
        : [...state.tanks, nextTank],
    }));
    message.success(editingCode ? '已更新储罐档案' : '已新增储罐档案');
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  const deleteTanks = (codes: string[]) => {
    const codeSet = new Set(codes);
    useMesStore.setState((state) => ({ tanks: state.tanks.filter((item) => !codeSet.has(item.code)) }));
    setSelectedRowKeys((keys) => keys.filter((key) => !codeSet.has(String(key))));
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>储罐档案</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="储罐编码 / 名称" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 260 }} />
          <Select allowClear placeholder="储罐物料" value={materialFilter} onChange={setMaterialFilter} style={{ width: 220 }} options={store.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
          <Select allowClear placeholder="所属产线" value={lineFilter} onChange={setLineFilter} style={{ width: 220 }} options={store.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
          <Select allowClear placeholder="启用状态" value={enabledFilter} onChange={setEnabledFilter} style={{ width: 160 }} options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">储罐档案</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" onClick={openCreate}>新增</Button>
          <Popconfirm title="确定删除选中的储罐档案吗？" onConfirm={() => deleteTanks(selectedRowKeys.map(String))}>
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
          scroll={{ x: 1250 }}
          columns={[
            { title: '储罐编码', dataIndex: 'code', width: 160 },
            { title: '储罐名称', dataIndex: 'name', width: 180 },
            { title: '储罐物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) },
            { title: '当前数量', dataIndex: 'currentQuantity', width: 120 },
            { title: '单位', dataIndex: 'unit', width: 100 },
            { title: '库存状态', dataIndex: 'inventoryStatus', width: 110, render: () => <Tag>库外</Tag> },
            { title: '所属产线', dataIndex: 'lineCode', width: 180, render: (v) => lineName(store, v) },
            { title: '启用状态', dataIndex: 'enabled', width: 100, render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag> },
            {
              title: '操作',
              width: 140,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => openEdit(row)}>编辑</Button>
                  <Popconfirm title="确定删除这条储罐档案吗？" onConfirm={() => deleteTanks([row.code])}>
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
        title={editingCode ? '编辑储罐档案' : '新增储罐档案'}
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
            <Form.Item label="储罐编码" name="code" rules={[{ required: true, message: '请输入储罐编码' }]} style={{ width: 220 }}>
              <Input disabled={Boolean(editingCode)} />
            </Form.Item>
            <Form.Item label="储罐名称" name="name" rules={[{ required: true, message: '请输入储罐名称' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="储罐物料" name="materialCode" rules={[{ required: true, message: '请选择储罐物料' }]} style={{ width: 220 }}>
              <Select options={store.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="当前数量" name="currentQuantity" rules={[{ required: true, message: '请输入当前数量' }]} style={{ width: 220 }}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="库存状态" name="inventoryStatus" style={{ width: 220 }}>
              <Input disabled value="库外" />
            </Form.Item>
            <Form.Item label="所属产线" name="lineCode" style={{ width: 220 }}>
              <Select allowClear options={store.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked" style={{ width: 220 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
