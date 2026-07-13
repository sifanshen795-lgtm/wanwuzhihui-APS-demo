import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import { useEffect, useMemo, useState, type Key } from 'react';
import { useMesStore } from '../../../store/useMesStore';

export function BaseMaterialCustomerPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const sortedCustomers = useMemo(() => [...data.customers].sort((a, b) => a.code.localeCompare(b.code)), [data.customers]);
  const editingCustomer = useMemo(
    () => (editingCode ? sortedCustomers.find((item) => item.code === editingCode) : null),
    [editingCode, sortedCustomers],
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingCustomer ?? { enabled: true });
  }, [editingCustomer, form, open]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setOpen(true);
  };

  const handleOpenEdit = (code: string) => {
    setEditingCode(code);
    setOpen(true);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const payload = {
      code: values.code,
      name: values.name,
      shortName: values.shortName,
      type: values.type,
      address: values.address,
      contact: values.contact,
      phone: values.phone,
      email: values.email,
      sales: values.sales,
      remark: values.remark,
      enabled: values.enabled ?? true,
      createdBy: editingCustomer?.createdBy ?? '斩叶龙',
      createdAt: editingCustomer?.createdAt ?? new Date().toISOString(),
    };
    if (editingCode) {
      data.editCustomerAction(editingCode, payload);
      message.success('已更新客户');
    } else {
      data.createCustomerAction(payload);
      message.success('已新增客户');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>客户列表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="客户编码" style={{ width: 420 }} />
          <Input allowClear placeholder="客户名称" style={{ width: 420 }} />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">客户列表</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的客户吗？" onConfirm={() => { selectedRowKeys.map(String).forEach(data.deleteCustomerAction); setSelectedRowKeys([]); }}>
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
          dataSource={sortedCustomers}
          pagination={false}
          scroll={{ x: 1900 }}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 70 },
            { title: '客户编码', dataIndex: 'code', width: 160, render: (v) => <a>{v}</a> },
            { title: '客户名称', dataIndex: 'name', width: 180 },
            { title: '客户简称', dataIndex: 'shortName', width: 140, render: (v) => v ?? '-' },
            { title: '客户类型', dataIndex: 'type', width: 140, render: (v) => v ?? '-' },
            { title: '客户地址', dataIndex: 'address', width: 220, render: (v) => v ?? '-' },
            { title: '客户联系人', dataIndex: 'contact', width: 120, render: (v) => v ?? '-' },
            { title: '客户电话', dataIndex: 'phone', width: 140, render: (v) => v ?? '-' },
            { title: '客户邮箱', dataIndex: 'email', width: 180, render: (v) => v ?? '-' },
            { title: '所属业务员', dataIndex: 'sales', width: 120, render: (v) => v ?? '-' },
            { title: '备注', dataIndex: 'remark', width: 120, render: (v) => v ?? '-' },
            { title: '启用状态', dataIndex: 'enabled', width: 110, render: (v) => <span style={{ color: v ? '#52c41a' : '#999', border: '1px solid', borderRadius: 4, padding: '2px 8px' }}>{v ? '启用' : '停用'}</span> },
            { title: '创建人', dataIndex: 'createdBy', width: 120, render: (v) => v ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (v) => (v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-') },
            {
              title: '操作',
              width: 120,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => handleOpenEdit(row.code)}>复制</Button>
                  <Button type="link" onClick={() => handleOpenEdit(row.code)}>编辑</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCode ? '编辑客户' : '新增客户'}
        open={open}
        onCancel={() => { setOpen(false); setEditingCode(null); form.resetFields(); }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={1200}
      >
        <Form form={form} layout="vertical" initialValues={editingCustomer ?? { enabled: true }}>
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="客户编码" name="code" rules={[{ required: true, message: '请输入客户编码' }]} style={{ width: 220 }}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
              <Form.Item label="客户名称" name="name" rules={[{ required: true, message: '请输入客户名称' }]} style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="客户简称" name="shortName" style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="客户类型" name="type" style={{ width: 220 }}>
                <Select placeholder="选择" options={[{ value: '终端客户', label: '终端客户' }, { value: '渠道客户', label: '渠道客户' }, { value: '贸易客户', label: '贸易客户' }]} />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="客户地址" name="address" style={{ width: 520 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="客户联系人" name="contact" style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="客户电话" name="phone" style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="客户邮箱" name="email" style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="所属业务员" name="sales" style={{ width: 220 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" style={{ width: 220 }}>
                <Switch checkedChildren="启用" unCheckedChildren="停用" defaultChecked />
              </Form.Item>
            </Space>
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={3} placeholder="输入" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
