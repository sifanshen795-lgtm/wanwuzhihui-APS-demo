import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, message } from 'antd';
import { useEffect, useMemo, useState, type Key } from 'react';
import { useMesStore } from '../../../store/useMesStore';

export function BaseMaterialColorPage() {
  const colorGrades = useMesStore((s) => s.colorGrades);
  const createColorGradeAction = useMesStore((s) => s.createColorGradeAction);
  const editColorGradeAction = useMesStore((s) => s.editColorGradeAction);
  const deleteColorGradeAction = useMesStore((s) => s.deleteColorGradeAction);
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const sortedGrades = useMemo(() => [...colorGrades].sort((a, b) => a.sort - b.sort), [colorGrades]);
  const editingGrade = useMemo(
    () => (editingCode ? sortedGrades.find((item) => item.code === editingCode) : null),
    [editingCode, sortedGrades],
  );
  const nextSort = useMemo(() => Math.max(0, ...sortedGrades.map((item) => item.sort)) + 1, [sortedGrades]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editingGrade ?? { sort: nextSort });
  }, [editingGrade, form, nextSort, open]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ sort: nextSort });
    setOpen(true);
  };

  const handleOpenEdit = (code: string) => {
    setEditingCode(code);
    setOpen(true);
  };

  const handleCopy = (row: typeof sortedGrades[number]) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ code: `${row.code}_COPY`, name: row.name, sort: nextSort });
    setOpen(true);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const payload = {
      code: values.code,
      name: values.name,
      sort: Number(values.sort ?? 0),
    };
    if (editingCode) {
      editColorGradeAction(editingCode, payload);
      message.success('已更新色级');
    } else {
      createColorGradeAction(payload);
      message.success('已新增色级');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>色级列表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="色级编码" style={{ width: 420 }} />
          <Input allowClear placeholder="色级名称" style={{ width: 420 }} />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">色级列表</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的色级吗？" onConfirm={() => { selectedRowKeys.map(String).forEach(deleteColorGradeAction); setSelectedRowKeys([]); }}>
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
          dataSource={sortedGrades}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 900 }}
          columns={[
            { title: '排序', dataIndex: 'sort', width: 100 },
            { title: '色级编码', dataIndex: 'code', width: 160 },
            { title: '色级名称', dataIndex: 'name' },
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
        title={editingCode ? '编辑色级' : '新增色级'}
        open={open}
        onCancel={() => { setOpen(false); setEditingCode(null); form.resetFields(); }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ sort: nextSort }}>
          <Form.Item label="色级编码" name="code" rules={[{ required: true, message: '请输入色级编码' }]}>
            <Input placeholder="输入，唯一" />
          </Form.Item>
          <Form.Item label="色级名称" name="name" rules={[{ required: true, message: '请输入色级名称' }]}>
            <Input placeholder="输入" />
          </Form.Item>
          <Form.Item label="排序" name="sort" rules={[{ required: true, message: '请输入排序' }]}>
            <Input type="number" placeholder="输入数字" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
