import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, message } from 'antd';
import { useEffect, useMemo, useState, type Key } from 'react';
import { useMesStore } from '../../../store/useMesStore';

export function WorkshopPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const sortedWorkshops = useMemo(() => [...data.workshops].sort((a, b) => a.code.localeCompare(b.code)), [data.workshops]);
  const editingWorkshop = useMemo(
    () => (editingCode ? sortedWorkshops.find((item) => item.code === editingCode) : null),
    [editingCode, sortedWorkshops],
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingWorkshop ?? {});
  }, [editingWorkshop, form, open]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    setOpen(true);
  };

  const handleOpenEdit = (code: string) => {
    setEditingCode(code);
    setOpen(true);
  };

  const handleCopy = (row: typeof sortedWorkshops[number]) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `${row.code}_COPY`,
      name: row.name,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const payload = { code: values.code, name: values.name };
    if (editingCode) {
      data.editWorkshopAction(editingCode, payload);
      message.success('已更新车间');
    } else {
      data.createWorkshopAction(payload);
      message.success('已新增车间');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>车间</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="车间编码" style={{ width: 420 }} />
          <Input allowClear placeholder="车间名称" style={{ width: 420 }} />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">车间</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的车间吗？" onConfirm={() => data.batchDeleteWorkshopAction(selectedRowKeys.map(String))}>
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
          dataSource={sortedWorkshops}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 900 }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 70 },
            { title: '车间编码', dataIndex: 'code', width: 240, render: (v) => <a>{v}</a> },
            { title: '车间名称', dataIndex: 'name', width: 320 },
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
        width={900}
      >
        <Form form={form} layout="vertical" initialValues={{}}>
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="车间编码" name="code" rules={[{ required: true, message: '请输入车间编码' }]} style={{ width: 320 }}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
              <Form.Item label="车间名称" name="name" rules={[{ required: true, message: '请输入车间名称' }]} style={{ width: 320 }}>
                <Input placeholder="输入" />
              </Form.Item>
            </Space>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
