import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { ProductionCraftConfigurator } from '../../../components/ProductionCraftConfigurator';
import { TableToolIcons } from '../../../components/ListPageTools';
import type { ProductionCraft } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';
import { materialName } from '../../../utils/display';

export function ProductionCraftPage() {
  const store = useMesStore();
  const [codeQuery, setCodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [appliedCodeQuery, setAppliedCodeQuery] = useState('');
  const [appliedNameQuery, setAppliedNameQuery] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [configuringCode, setConfiguringCode] = useState<string | null>(null);
  const [form] = Form.useForm();

  const rows = useMemo(() => [...store.productionCrafts]
    .filter((item) => !appliedCodeQuery || item.code.includes(appliedCodeQuery))
    .filter((item) => !appliedNameQuery || item.name.includes(appliedNameQuery))
    .sort((a, b) => b.code.localeCompare(a.code)), [appliedCodeQuery, appliedNameQuery, store.productionCrafts]);

  const editingCraft = editingCode ? store.productionCrafts.find((item) => item.code === editingCode) : null;
  const configuringCraft = configuringCode ? store.productionCrafts.find((item) => item.code === configuringCode) : null;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingCraft ?? { enabled: true });
  }, [editingCraft, form, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ProductionCraft = {
      code: values.code.trim(),
      name: values.name.trim(),
      materialCode: values.materialCode,
      enabled: values.enabled ?? true,
      remark: values.remark?.trim(),
      nodes: editingCraft?.nodes ?? [],
      edges: editingCraft?.edges ?? [],
      createdBy: editingCraft?.createdBy ?? '斩叶龙',
      createdAt: editingCraft?.createdAt ?? dayjs().toISOString(),
    };
    if (editingCode) {
      store.editProductionCraftAction(editingCode, payload);
      message.success('已更新生产工艺');
    } else {
      store.createProductionCraftAction(payload);
      message.success('已新增生产工艺');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title"><h2>生产工艺</h2></div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="工艺编码" value={codeQuery} onChange={(event) => setCodeQuery(event.target.value)} style={{ width: 420 }} />
          <Input allowClear placeholder="工艺名称" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} style={{ width: 420 }} />
          <Button type="primary" onClick={() => { setAppliedCodeQuery(codeQuery.trim()); setAppliedNameQuery(nameQuery.trim()); }}>查询</Button>
          <Button onClick={() => { setCodeQuery(''); setNameQuery(''); setAppliedCodeQuery(''); setAppliedNameQuery(''); }}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">生产工艺</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={() => { setEditingCode(null); form.resetFields(); form.setFieldsValue({ enabled: true }); setOpen(true); }}>新增</Button>
          <Popconfirm title="确定删除选中的生产工艺吗？" onConfirm={() => { store.deleteProductionCraftsAction(selectedRowKeys.map(String)); setSelectedRowKeys([]); message.success('已删除'); }}>
            <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <Button>导入</Button>
          <Button>导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={rows}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          scroll={{ x: 1600 }}
          columns={[
            { title: '序号', width: 70, render: (_, __, index) => index + 1 },
            { title: '工艺编码', dataIndex: 'code', width: 180, render: (value) => <a>{value}</a> },
            { title: '工艺名称', dataIndex: 'name', width: 260 },
            { title: '适用物料', dataIndex: 'materialCode', width: 240, render: (value) => materialName(store, value) },
            { title: '启用状态', dataIndex: 'enabled', width: 110, render: (value: boolean) => <span style={{ color: value ? '#52c41a' : '#999', border: '1px solid', borderRadius: 4, padding: '2px 8px' }}>{value ? '启用' : '停用'}</span> },
            { title: '备注', dataIndex: 'remark', width: 220, render: (value) => value ?? '-' },
            { title: '创建人', dataIndex: 'createdBy', width: 120, render: (value) => value ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-') },
            {
              title: '操作',
              width: 220,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => { setConfiguringCode(row.code); setConfigOpen(true); }}>工艺配置</Button>
                  <Button type="link" onClick={() => { setEditingCode(row.code); setOpen(true); }}>编辑</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCode ? '编辑' : '新增'}
        open={open}
        onCancel={() => { setOpen(false); setEditingCode(null); form.resetFields(); }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={900}
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
          <Space wrap>
            <Form.Item label="工艺编码" name="code" rules={[{ required: true, message: '请输入工艺编码' }]} style={{ width: 220 }}>
              <Input placeholder="输入，唯一" disabled={Boolean(editingCode)} />
            </Form.Item>
            <Form.Item label="工艺名称" name="name" rules={[{ required: true, message: '请输入工艺名称' }]} style={{ width: 220 }}>
              <Input placeholder="输入" />
            </Form.Item>
            <Form.Item label="适用物料" name="materialCode" rules={[{ required: true, message: '请选择适用物料' }]} style={{ width: 220 }}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择物料"
                options={store.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))}
              />
            </Form.Item>
            <Form.Item label="启用状态" name="enabled" valuePropName="checked" style={{ width: 220 }}>
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
            <Form.Item label="备注" name="remark" style={{ width: 460 }}>
              <Input placeholder="输入" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <ProductionCraftConfigurator
        open={configOpen}
        craft={configuringCraft ?? null}
        processes={store.productionProcesses}
        materials={store.materials}
        onCancel={() => { setConfigOpen(false); setConfiguringCode(null); }}
        onSave={(payload) => {
          if (!configuringCode) return;
          store.updateProductionCraftConfigAction(configuringCode, payload);
          message.success('工艺配置已保存');
          setConfigOpen(false);
          setConfiguringCode(null);
        }}
      />
    </div>
  );
}
