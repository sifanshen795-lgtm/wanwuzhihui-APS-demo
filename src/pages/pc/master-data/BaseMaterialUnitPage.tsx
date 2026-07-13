import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { useMesStore } from '../../../store/useMesStore';

export function BaseMaterialUnitPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const sortedUnits = useMemo(() => [...data.units].sort((a, b) => a.code.localeCompare(b.code)), [data.units]);
  const editingUnit = useMemo(
    () => (editingCode ? sortedUnits.find((item) => item.code === editingCode) : null),
    [editingCode, sortedUnits],
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingUnit ?? { inclusionRule: '四舍五入', precisionRule: '固定小数位', precisionValue: 3, enabled: true });
  }, [editingUnit, form, open]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ inclusionRule: '四舍五入', precisionRule: '固定小数位', precisionValue: 3, enabled: true });
    setOpen(true);
  };

  const handleOpenEdit = (code: string) => {
    setEditingCode(code);
    setOpen(true);
  };

  const handleCopy = (row: typeof sortedUnits[number]) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `${row.code}_COPY`,
      name: row.name,
      inclusionRule: row.inclusionRule,
      precisionRule: row.precisionRule,
      precisionValue: row.precisionValue,
      remark: row.remark,
      enabled: row.enabled,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const payload = {
      code: values.code,
      name: values.name,
      inclusionRule: values.inclusionRule,
      precisionRule: values.precisionRule,
      precisionValue: Number(values.precisionValue ?? 0),
      remark: values.remark,
      enabled: values.enabled ?? true,
      createdBy: editingUnit?.createdBy ?? '斩叶龙',
      createdAt: editingUnit?.createdAt ?? new Date().toISOString(),
    };
    if (editingCode) {
      data.editUnitAction(editingCode, payload);
      message.success('已更新单位');
    } else {
      data.createUnitAction(payload);
      message.success('已新增单位');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>单位列表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="单位编码" style={{ width: 420 }} />
          <Input allowClear placeholder="单位名称" style={{ width: 420 }} />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">单位列表</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的单位吗？" onConfirm={() => data.batchDeleteUnitAction(selectedRowKeys.map(String))}>
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
          dataSource={sortedUnits}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1700 }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 70 },
            { title: '单位编码', dataIndex: 'code', width: 260, render: (v) => <a>{v}</a> },
            { title: '单位名称', dataIndex: 'name', width: 260 },
            { title: '舍入规则', dataIndex: 'inclusionRule', width: 120 },
            { title: '精度规则', dataIndex: 'precisionRule', width: 120 },
            { title: '精度值', dataIndex: 'precisionValue', width: 80, render: (v) => `${v}位` },
            { title: '备注', dataIndex: 'remark', width: 260, render: (v) => v ?? '-' },
            { title: '启用状态', dataIndex: 'enabled', width: 110, render: (v) => <span style={{ color: '#52c41a', border: '1px solid #b7eb8f', borderRadius: 4, padding: '2px 8px', background: '#f6ffed' }}>{v ? '启用' : '停用'}</span> },
            { title: '创建人', dataIndex: 'createdBy', width: 120, render: (v) => v ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
            {
              title: '操作',
              width: 120,
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
        width={1200}
      >
        <Form form={form} layout="vertical" initialValues={{ inclusionRule: '四舍五入', precisionRule: '固定小数位', precisionValue: 3, enabled: true }}>
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="单位编码" name="code" rules={[{ required: true, message: '请输入单位编码' }]} style={{ width: 240 }}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
              <Form.Item label="单位名称" name="name" rules={[{ required: true, message: '请输入单位名称' }]} style={{ width: 240 }}>
                <Input placeholder="输入" />
              </Form.Item>
              <Form.Item label="舍入规则" name="inclusionRule" style={{ width: 240 }}>
                <Select options={[{ value: '四舍五入', label: '四舍五入' }, { value: '向上取整', label: '向上取整' }, { value: '向下取整', label: '向下取整' }]} />
              </Form.Item>
              <Form.Item label="精度规则" name="precisionRule" style={{ width: 240 }}>
                <Select options={[{ value: '固定小数位', label: '固定小数位' }, { value: '有效位数', label: '有效位数' }]} />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="精度值" name="precisionValue" style={{ width: 240 }}>
                <Input type="number" placeholder="输入" addonAfter="位" />
              </Form.Item>
              <Form.Item label="备注" name="remark" style={{ width: 720 }}>
                <Input.TextArea rows={3} placeholder="输入" />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%' }}>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" style={{ width: 240 }}>
                <Switch checkedChildren="启用" unCheckedChildren="停用" defaultChecked />
              </Form.Item>
            </Space>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
