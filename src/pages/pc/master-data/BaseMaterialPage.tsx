import { Button, Card, Col, Form, Input, Modal, Row, Select, Space, Switch, Table, Tag, message, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState, type Key } from 'react';
import type { Material } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';

type MaterialFormValues = Omit<Material, 'periodDays'> & {
  periodDays?: number | string;
};

export function BaseMaterialPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const filteredMaterials = useMemo(
    () => data.materials.filter((item) => (!nameQuery || item.name.includes(nameQuery)) && (!codeQuery || item.code.includes(codeQuery))),
    [data.materials, codeQuery, nameQuery],
  );

  const handleCopy = () => {
    setEditingCode(null);
    setOpen(true);
  };

  const handleSubmit = (values: MaterialFormValues) => {
    const editingMaterial = editingCode ? data.materials.find((item) => item.code === editingCode) : null;
    const payload: Material = {
      code: values.code.trim(),
      name: values.name.trim(),
      type: values.type,
      materialAttr: values.materialAttr,
      spec: values.spec?.trim(),
      periodDays: values.periodDays === undefined || values.periodDays === '' ? undefined : Number(values.periodDays),
      baseUnit: values.baseUnit,
      inventoryUnit: values.inventoryUnit,
      productionUnit: values.productionUnit,
      purchaseUnit: values.purchaseUnit,
      salesUnit: values.salesUnit,
      colorGradeCode: values.colorGradeCode,
      remark: values.remark?.trim(),
      enabled: values.enabled ?? true,
      createdBy: editingMaterial?.createdBy ?? '斩叶龙',
      createdAt: editingMaterial?.createdAt ?? dayjs().toISOString(),
    };
    if (editingCode) {
      data.editMaterialAction(editingCode, payload);
      message.success('已更新物料');
    } else {
      data.createMaterialAction(payload);
      message.success('已新增物料');
    }
    setNameQuery('');
    setCodeQuery('');
    setOpen(false);
    setEditingCode(null);
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>物料列表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="物料编码" value={codeQuery} onChange={(e) => setCodeQuery(e.target.value)} style={{ width: 420 }} />
          <Input allowClear placeholder="物料名称" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} style={{ width: 420 }} />
          <Button type="primary">查询</Button>
          <Button onClick={() => { setNameQuery(''); setCodeQuery(''); }}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">物料列表</div>
        <div className="table-actions">
          <span style={{ color: 'var(--color-text-secondary)', marginRight: 8 }}>已选：{selectedRowKeys.length}（当页已选：{selectedRowKeys.length}）</span>
          <Button type="primary" onClick={() => { setEditingCode(null); setOpen(true); }}>新增</Button>
          <Popconfirm title="确定删除选中的物料吗？" onConfirm={() => { selectedRowKeys.map(String).forEach((code) => data.deleteMaterialAction(code)); setSelectedRowKeys([]); }}>
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
          dataSource={filteredMaterials}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 2200 }}
          columns={[
            { title: '物料编码', dataIndex: 'code' },
            { title: '物料名称', dataIndex: 'name' },
            { title: '物料规格', dataIndex: 'spec' },
            { title: '物料种类', dataIndex: 'type' },
            { title: '物料属性', dataIndex: 'materialAttr' },
            { title: '有效期（天）', dataIndex: 'periodDays', render: (v) => v ?? '-' },
            { title: '基本单位', dataIndex: 'baseUnit' },
            { title: '库存单位', dataIndex: 'inventoryUnit', render: (v) => v ?? '-' },
            { title: '生产单位', dataIndex: 'productionUnit', render: (v) => v ?? '-' },
            { title: '采购单位', dataIndex: 'purchaseUnit', render: (v) => v ?? '-' },
            { title: '销售单位', dataIndex: 'salesUnit', render: (v) => v ?? '-' },
            { title: '物料色级', dataIndex: 'colorGradeCode', render: (v) => data.colorGrades.find((g) => g.code === v)?.name ?? '-' },
            { title: '备注', dataIndex: 'remark', render: (v) => v ?? '-' },
            { title: '启用状态', dataIndex: 'enabled', render: (v, row) => <Switch checked={!!v} onChange={() => data.toggleMaterialEnabledAction(row.code)} /> },
            { title: '创建人', dataIndex: 'createdBy', render: (v) => v ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
            {
              title: '操作',
              width: 140,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={handleCopy}>复制</Button>
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
        onCancel={() => { setOpen(false); setEditingCode(null); }}
        footer={null}
        destroyOnClose
        width={1100}
        styles={{ body: { paddingTop: 8 } }}
      >
        <Form
          layout="vertical"
          initialValues={editingCode ? data.materials.find((item) => item.code === editingCode) : { enabled: true, materialAttr: '外购', baseUnit: 'kg', inventoryUnit: 'kg', productionUnit: 'kg', purchaseUnit: 'kg', salesUnit: 'kg' }}
          onFinish={(values) => handleSubmit(values as MaterialFormValues)}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="物料编码" name="code" rules={[{ required: true, message: '请输入物料编码' }]}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="物料名称" name="name" rules={[{ required: true, message: '请输入物料名称' }]}>
                <Input placeholder="输入" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="物料规格" name="spec" rules={[{ required: true, message: '请输入物料规格' }]}>
                <Input placeholder="输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="物料种类" name="type" rules={[{ required: true, message: '请选择物料种类' }]}>
                <Select placeholder="模糊下拉，单选（字典表）" options={[{ value: '原料', label: '原料' }, { value: '中间物料', label: '中间物料' }, { value: '基准料', label: '基准料' }, { value: '主产品', label: '主产品' }, { value: '成品', label: '成品' }]} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="物料属性" name="materialAttr" rules={[{ required: true, message: '请选择物料属性' }]}>
                <Select placeholder="请选择" options={[{ value: '自制', label: '自制' }, { value: '外购', label: '外购' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="有效期" name="periodDays">
                <Input type="number" placeholder="输入，正整数" addonAfter="天" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="基本单位" name="baseUnit" rules={[{ required: true, message: '请选择基本单位' }]}>
                <Select placeholder="模糊下拉，单选（单位列表）" options={[
                  { value: 'kg', label: 'kg' },
                  { value: '包', label: '包' },
                  { value: '锅', label: '锅' },
                ]} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="库存单位" name="inventoryUnit">
                <Select placeholder="默认与基本单位一致，可修改" options={[
                  { value: 'kg', label: 'kg' },
                  { value: '包', label: '包' },
                  { value: '锅', label: '锅' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="生产单位" name="productionUnit">
                <Select placeholder="默认与基本单位一致，可修改" options={[
                  { value: 'kg', label: 'kg' },
                  { value: '包', label: '包' },
                  { value: '锅', label: '锅' },
                ]} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="采购单位" name="purchaseUnit">
                <Select placeholder="默认与基本单位一致，可修改" options={[
                  { value: 'kg', label: 'kg' },
                  { value: '包', label: '包' },
                  { value: '锅', label: '锅' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="销售单位" name="salesUnit">
                <Select placeholder="默认与基本单位一致，可修改" options={[
                  { value: 'kg', label: 'kg' },
                  { value: '包', label: '包' },
                  { value: '锅', label: '锅' },
                ]} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="物料色级" name="colorGradeCode">
                <Select allowClear placeholder="用于由浅至深排程" options={data.colorGrades.map((item) => ({ value: item.code, label: item.name }))} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} placeholder="输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" initialValue>
                <Switch checkedChildren="启用" unCheckedChildren="停用" defaultChecked />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button type="primary" htmlType="submit">确定</Button>
              <Button onClick={() => setOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
