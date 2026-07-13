import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import type { Key } from 'react';
import { useMemo, useState } from 'react';
import { SelectedCountText, TableToolIcons } from '../../../components/ListPageTools';
import type { ProductGroupRelation } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';
import { materialName } from '../../../utils/display';

type ProductGroupFormValues = ProductGroupRelation;

export function ProductGroupRelationPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>();
  const [enabledFilter, setEnabledFilter] = useState<boolean>();
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', materialFilter: undefined as string | undefined, enabledFilter: undefined as boolean | undefined });
  const [form] = Form.useForm<ProductGroupFormValues>();

  const productGroups = useMemo(() => (data.productGroupRelations ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)), [data.productGroupRelations]);
  const editingRow = useMemo(() => (editingCode ? productGroups.find((item) => item.code === editingCode) ?? null : null), [editingCode, productGroups]);
  const materialOptions = useMemo(() => data.materials
    .filter((item) => item.enabled && ['主产品', '成品', '中间物料'].includes(item.type))
    .map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` })), [data.materials]);

  const filteredRows = useMemo(() => productGroups
    .filter((row) => !appliedFilters.keyword || `${row.code} ${row.name} ${row.remark ?? ''}`.includes(appliedFilters.keyword))
    .filter((row) => !appliedFilters.materialFilter || row.materials.includes(appliedFilters.materialFilter))
    .filter((row) => appliedFilters.enabledFilter === undefined || row.enabled === appliedFilters.enabledFilter), [appliedFilters, productGroups]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ code: `PG-${String(productGroups.length + 1).padStart(2, '0')}`, name: '', materials: [], enabled: true });
    setOpen(true);
  };

  const handleOpenEdit = (row: ProductGroupRelation) => {
    setEditingCode(row.code);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const handleCopy = (row: ProductGroupRelation) => {
    setEditingCode(null);
    form.setFieldsValue({ ...row, code: `${row.code}-COPY`, name: `${row.name} 副本` });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ProductGroupRelation = {
      code: values.code.trim(),
      name: values.name.trim(),
      materials: values.materials ?? [],
      enabled: values.enabled ?? true,
      remark: values.remark?.trim(),
    };
    if (editingCode) {
      data.editProductGroupRelationAction(editingCode, payload);
      message.success('已更新产品组关系');
    } else {
      data.createProductGroupRelationAction(payload);
      message.success('已新增产品组关系');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  const handleDelete = (code: string) => {
    data.deleteProductGroupRelationAction(code);
    setSelectedRowKeys((keys) => keys.filter((key) => key !== code));
    message.success('已删除产品组关系');
  };

  const handleBatchDelete = () => {
    data.batchDeleteProductGroupRelationAction(selectedRowKeys.map(String));
    setSelectedRowKeys([]);
    message.success('已批量删除产品组关系');
  };

  const handleSearch = () => setAppliedFilters({ keyword, materialFilter, enabledFilter });

  const handleReset = () => {
    setKeyword('');
    setMaterialFilter(undefined);
    setEnabledFilter(undefined);
    setAppliedFilters({ keyword: '', materialFilter: undefined, enabledFilter: undefined });
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>产品组关系表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="产品组编码/名称/备注" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 240 }} />
          <Select allowClear showSearch placeholder="包含物料" value={materialFilter} onChange={setMaterialFilter} style={{ width: 260 }} options={materialOptions} optionFilterProp="label" />
          <Select allowClear placeholder="启用状态" value={enabledFilter} onChange={setEnabledFilter} style={{ width: 160 }} options={[{ value: true, label: '启用' }, { value: false, label: '禁用' }]} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">产品组关系列表</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的产品组关系吗？" onConfirm={handleBatchDelete}>
            <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={filteredRows}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1100 }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 70 },
            { title: '产品组编码', dataIndex: 'code', width: 180 },
            { title: '产品组名称', dataIndex: 'name', width: 180 },
            { title: '包含物料', dataIndex: 'materials', render: (v) => (v as string[]).map((code) => materialName(data, code)).join('、') },
            { title: '状态', dataIndex: 'enabled', width: 100, render: (v) => (v ? '启用' : '停用') },
            { title: '备注', dataIndex: 'remark', width: 240, render: (v) => v || '-' },
            {
              title: '操作',
              width: 180,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => handleCopy(row)}>复制</Button>
                  <Button type="link" onClick={() => handleOpenEdit(row)}>编辑</Button>
                  <Popconfirm title="确定删除该产品组关系吗？" onConfirm={() => handleDelete(row.code)}>
                    <Button type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCode ? '编辑产品组关系' : '新增产品组关系'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingCode(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="产品组编码" rules={[{ required: true, message: '请输入产品组编码' }]}>
            <Input placeholder="如 PG-01" />
          </Form.Item>
          <Form.Item name="name" label="产品组名称" rules={[{ required: true, message: '请输入产品组名称' }]}>
            <Input placeholder="如 改性塑料组" />
          </Form.Item>
          <Form.Item name="materials" label="包含物料" rules={[{ required: true, message: '请选择包含物料' }]}>
            <Select mode="multiple" showSearch placeholder="选择主产品/成品/中间物料" options={materialOptions} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="用于说明同类产品排程归类规则" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
