import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { TableToolIcons } from '../../../components/ListPageTools';
import type { ProductionProcess } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';

const BUSINESS_DOCS = ['产线运行单', '充装登记', '钢瓶处理'];
const PROCESS_ATTRS = ['通用', '包装'];

export function ProductionProcessPage() {
  const store = useMesStore();
  const [codeQuery, setCodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [appliedCodeQuery, setAppliedCodeQuery] = useState('');
  const [appliedNameQuery, setAppliedNameQuery] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form] = Form.useForm();

  const formNameMap = useMemo(
    () => new Map(store.productionForms.map((item) => [item.code, item.name])),
    [store.productionForms],
  );

  const rows = useMemo(() => [...store.productionProcesses]
    .filter((item) => !appliedCodeQuery || item.code.includes(appliedCodeQuery))
    .filter((item) => !appliedNameQuery || item.name.includes(appliedNameQuery))
    .sort((a, b) => b.code.localeCompare(a.code)), [appliedCodeQuery, appliedNameQuery, store.productionProcesses]);

  const editingProcess = editingCode ? store.productionProcesses.find((item) => item.code === editingCode) : null;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingProcess ?? { enabled: true, processAttr: '通用', businessDoc: BUSINESS_DOCS[0] });
  }, [editingProcess, form, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ProductionProcess = {
      code: values.code.trim(),
      name: values.name.trim(),
      processAttr: values.processAttr,
      formCode: values.formCode,
      businessDoc: values.businessDoc,
      enabled: values.enabled ?? true,
      remark: values.remark?.trim(),
      createdBy: editingProcess?.createdBy ?? '斩叶龙',
      createdAt: editingProcess?.createdAt ?? dayjs().toISOString(),
    };
    if (editingCode) {
      store.editProductionProcessAction(editingCode, payload);
      message.success('已更新生产工序');
    } else {
      store.createProductionProcessAction(payload);
      message.success('已新增生产工序');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  const handleCopy = (row: ProductionProcess) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `${row.code}_COPY`,
      name: `${row.name}（复制）`,
      processAttr: row.processAttr,
      formCode: row.formCode,
      businessDoc: row.businessDoc,
      enabled: row.enabled,
      remark: row.remark,
    });
    setOpen(true);
  };

  return (
    <div className="page">
      <div className="page-title"><h2>生产工序</h2></div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="工序编码" value={codeQuery} onChange={(event) => setCodeQuery(event.target.value)} style={{ width: 420 }} />
          <Input allowClear placeholder="工序名称" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} style={{ width: 420 }} />
          <Button type="primary" onClick={() => { setAppliedCodeQuery(codeQuery.trim()); setAppliedNameQuery(nameQuery.trim()); }}>查询</Button>
          <Button onClick={() => { setCodeQuery(''); setNameQuery(''); setAppliedCodeQuery(''); setAppliedNameQuery(''); }}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">生产工序</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={() => { setEditingCode(null); form.resetFields(); form.setFieldsValue({ enabled: true, processAttr: '通用', businessDoc: BUSINESS_DOCS[0] }); setOpen(true); }}>新增</Button>
          <Popconfirm title="确定删除选中的生产工序吗？" onConfirm={() => { store.deleteProductionProcessesAction(selectedRowKeys.map(String)); setSelectedRowKeys([]); message.success('已删除'); }}>
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
          scroll={{ x: 1500 }}
          columns={[
            { title: '序号', width: 70, render: (_, __, index) => index + 1 },
            { title: '工序编码', dataIndex: 'code', width: 180, render: (value) => <a>{value}</a> },
            { title: '工序名称', dataIndex: 'name', width: 220 },
            { title: '工序属性', dataIndex: 'processAttr', width: 110 },
            { title: '表单名称', dataIndex: 'formCode', width: 240, render: (value) => (value ? formNameMap.get(value) ?? value : '-') },
            { title: '适用业务单据', dataIndex: 'businessDoc', width: 160, render: (value) => value ?? '-' },
            { title: '启用状态', dataIndex: 'enabled', width: 110, render: (value: boolean) => <span style={{ color: value ? '#52c41a' : '#999', border: '1px solid', borderRadius: 4, padding: '2px 8px' }}>{value ? '启用' : '停用'}</span> },
            { title: '备注', dataIndex: 'remark', width: 220, render: (value) => value ?? '-' },
            { title: '创建人', dataIndex: 'createdBy', width: 120, render: (value) => value ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-') },
            {
              title: '操作',
              width: 160,
              fixed: 'right',
              render: (_, row) => (
                <Space>
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
        <Form form={form} layout="vertical" initialValues={{ enabled: true, processAttr: '通用', businessDoc: BUSINESS_DOCS[0] }}>
          <Space wrap>
            <Form.Item label="工序编码" name="code" rules={[{ required: true, message: '请输入工序编码' }]} style={{ width: 220 }}>
              <Input placeholder="输入，唯一" disabled={Boolean(editingCode)} />
            </Form.Item>
            <Form.Item label="工序名称" name="name" rules={[{ required: true, message: '请输入工序名称' }]} style={{ width: 220 }}>
              <Input placeholder="输入" />
            </Form.Item>
            <Form.Item label="工序属性" name="processAttr" rules={[{ required: true, message: '请选择工序属性' }]} style={{ width: 220 }}>
              <Select options={PROCESS_ATTRS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item label="关联表单" name="formCode" style={{ width: 220 }}>
              <Select
                allowClear
                placeholder="选择生产表单"
                options={store.productionForms.filter((item) => item.enabled).map((item) => ({ value: item.code, label: item.name }))}
              />
            </Form.Item>
            <Form.Item label="适用业务单据" name="businessDoc" style={{ width: 220 }}>
              <Select options={BUSINESS_DOCS.map((item) => ({ value: item, label: item }))} />
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
    </div>
  );
}
