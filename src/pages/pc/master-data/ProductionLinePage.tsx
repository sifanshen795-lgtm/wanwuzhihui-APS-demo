import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { useMesStore } from '../../../store/useMesStore';

export function ProductionLinePage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const sortedLines = useMemo(() => [...data.lines].sort((a, b) => a.code.localeCompare(b.code)), [data.lines]);
  const editingLine = useMemo(
    () => (editingCode ? sortedLines.find((item) => item.code === editingCode) : null),
    [editingCode, sortedLines],
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingLine ?? { stage: '配色', enabled: true });
  }, [editingLine, form, open]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ stage: '配色', enabled: true });
    setOpen(true);
  };

  const handleOpenEdit = (code: string) => {
    setEditingCode(code);
    setOpen(true);
  };

  const handleCopy = (row: typeof sortedLines[number]) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `${row.code}_COPY`,
      name: row.name,
      workshopCode: row.workshopCode,
      stage: row.stage,
      enabled: row.enabled,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const payload = {
      code: values.code,
      name: values.name,
      workshopCode: values.workshopCode,
      stage: values.stage,
      enabled: values.enabled ?? true,
    };
    try {
      if (editingCode) {
        data.editLineAction(editingCode, payload);
        message.success('已更新产线');
      } else {
        data.createLineAction(payload);
        message.success('已新增产线');
      }
    } catch (error) {
      message.error((error as Error).message);
      return;
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>产线</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="产线编码" style={{ width: 420 }} />
          <Input allowClear placeholder="产线名称" style={{ width: 420 }} />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">产线</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的产线吗？" onConfirm={() => data.batchDeleteLineAction(selectedRowKeys.map(String))}>
            <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <Button>导入</Button>
          <Button>批量导出</Button>
          <Button shape="circle">⌕</Button>
          <Button shape="circle">⚙</Button>
          <Button shape="circle">↻</Button>
          <Button shape="circle">⤢</Button>
          <Button shape="circle">☷</Button>
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={sortedLines}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1400 }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 70 },
            { title: '产线编码', dataIndex: 'code', width: 220, render: (v) => <a>{v}</a> },
            { title: '产线名称', dataIndex: 'name', width: 260 },
            { title: '阶段', dataIndex: 'stage', width: 120 },
            { title: '所属车间', dataIndex: 'workshopCode', width: 220, render: (v) => data.workshops.find((w) => w.code === v)?.name ?? v },
            { title: '启用状态', dataIndex: 'enabled', width: 110, render: (v) => <span style={{ color: v ? '#52c41a' : '#999', border: '1px solid', borderRadius: 4, padding: '2px 8px' }}>{v ? '启用' : '停用'}</span> },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
            {
              title: '操作',
              width: 140,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => handleCopy(row)}>复制</Button>
                  <Button type="link" onClick={() => handleOpenEdit(row.code)}>编辑</Button>
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
        width={1000}
      >
        <Form form={form} layout="vertical" initialValues={{ stage: '配色', enabled: true }}>
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="产线编码" name="code" rules={[{ required: true, message: '请输入产线编码' }]} style={{ width: 220 }}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
              <Form.Item label="产线名称" name="name" rules={[{ required: true, message: '请输入产线名称' }]} style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="所属车间" name="workshopCode" rules={[{ required: true, message: '请选择所属车间' }]} style={{ width: 220 }}>
                <Select options={data.workshops.map((item) => ({ value: item.code, label: item.name }))} placeholder="选择" />
              </Form.Item>
              <Form.Item label="阶段" name="stage" style={{ width: 220 }}>
                <Select options={[{ value: '配色', label: '配色' }, { value: '配料', label: '配料' }, { value: '挤出', label: '挤出' }]} />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%' }}>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" style={{ width: 220 }}>
                <Switch checkedChildren="启用" unCheckedChildren="停用" defaultChecked />
              </Form.Item>
            </Space>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
