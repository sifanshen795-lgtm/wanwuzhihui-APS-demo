import { Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { ProductionFormDesigner } from '../../../components/ProductionFormDesigner';
import { TableToolIcons } from '../../../components/ListPageTools';
import type { ProductionForm } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';

export function ProductionFormPage() {
  const store = useMesStore();
  const [codeQuery, setCodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [appliedCodeQuery, setAppliedCodeQuery] = useState('');
  const [appliedNameQuery, setAppliedNameQuery] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [open, setOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [designingCode, setDesigningCode] = useState<string | null>(null);
  const [form] = Form.useForm();

  const rows = useMemo(() => [...store.productionForms]
    .filter((item) => !appliedCodeQuery || item.code.includes(appliedCodeQuery))
    .filter((item) => !appliedNameQuery || item.name.includes(appliedNameQuery))
    .sort((a, b) => b.code.localeCompare(a.code)), [appliedCodeQuery, appliedNameQuery, store.productionForms]);

  const editingForm = editingCode ? store.productionForms.find((item) => item.code === editingCode) : null;
  const designingForm = designingCode ? store.productionForms.find((item) => item.code === designingCode) : null;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingForm ?? { enabled: true });
  }, [editingForm, form, open]);

  const handleSearch = () => {
    setAppliedCodeQuery(codeQuery.trim());
    setAppliedNameQuery(nameQuery.trim());
  };

  const handleReset = () => {
    setCodeQuery('');
    setNameQuery('');
    setAppliedCodeQuery('');
    setAppliedNameQuery('');
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ProductionForm = {
      code: values.code.trim(),
      name: values.name.trim(),
      enabled: values.enabled ?? true,
      remark: values.remark?.trim(),
      fields: editingForm?.fields ?? [],
      createdBy: editingForm?.createdBy ?? '斩叶龙',
      createdAt: editingForm?.createdAt ?? dayjs().toISOString(),
    };
    if (editingCode) {
      store.editProductionFormAction(editingCode, payload);
      message.success('已更新生产表单');
    } else {
      store.createProductionFormAction(payload);
      message.success('已新增生产表单');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  const handleCopy = (row: ProductionForm) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `${row.code}_COPY`,
      name: `${row.name}（复制）`,
      enabled: row.enabled,
      remark: row.remark,
    });
    setOpen(true);
  };

  return (
    <div className="page">
      <div className="page-title"><h2>生产表单</h2></div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="表单编码" value={codeQuery} onChange={(event) => setCodeQuery(event.target.value)} style={{ width: 420 }} />
          <Input allowClear placeholder="表单名称" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} style={{ width: 420 }} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">生产表单</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={() => { setEditingCode(null); form.resetFields(); form.setFieldsValue({ enabled: true }); setOpen(true); }}>新增</Button>
          <Popconfirm title="确定删除选中的生产表单吗？" onConfirm={() => { store.deleteProductionFormsAction(selectedRowKeys.map(String)); setSelectedRowKeys([]); message.success('已删除'); }}>
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
          scroll={{ x: 1400 }}
          columns={[
            { title: '序号', width: 70, render: (_, __, index) => index + 1 },
            { title: '表单编码', dataIndex: 'code', width: 180, render: (value) => <a>{value}</a> },
            { title: '表单名称', dataIndex: 'name', width: 260 },
            { title: '字段数', dataIndex: 'fields', width: 100, render: (fields: ProductionForm['fields']) => fields.length },
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
                  <Button type="link" onClick={() => { setDesigningCode(row.code); setDesignOpen(true); }}>表单设计</Button>
                  <Button type="link" onClick={() => handleCopy(row)}>复制</Button>
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
            <Form.Item label="表单编码" name="code" rules={[{ required: true, message: '请输入表单编码' }]} style={{ width: 220 }}>
              <Input placeholder="输入，唯一" disabled={Boolean(editingCode)} />
            </Form.Item>
            <Form.Item label="表单名称" name="name" rules={[{ required: true, message: '请输入表单名称' }]} style={{ width: 220 }}>
              <Input placeholder="输入" />
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

      <ProductionFormDesigner
        open={designOpen}
        form={designingForm ?? null}
        onCancel={() => { setDesignOpen(false); setDesigningCode(null); }}
        onSave={(fields) => {
          if (!designingCode) return;
          store.updateProductionFormDesignAction(designingCode, fields);
          message.success('表单设计已保存');
          setDesignOpen(false);
          setDesigningCode(null);
        }}
      />
    </div>
  );
}
