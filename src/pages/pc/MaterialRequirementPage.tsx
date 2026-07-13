import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import { SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { MaterialRequirement } from '../../domain/models/mes';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

type RequirementFormValues = Omit<MaterialRequirement, 'requiredQuantity' | 'bomLevel'> & {
  requiredQuantity: number | string;
  bomLevel: number | string;
};

type RequirementTreeRow = MaterialRequirement & {
  children?: RequirementTreeRow[];
};

const buildRequirementTree = (requirements: MaterialRequirement[]) => {
  const sorted = [...requirements].sort((a, b) => a.bomLevel - b.bomLevel || a.id.localeCompare(b.id));
  const rowByBomItemId = new Map<string, RequirementTreeRow>();
  const roots: RequirementTreeRow[] = [];

  sorted.forEach((requirement) => {
    const row: RequirementTreeRow = { ...requirement };
    if (requirement.bomItemId) {
      rowByBomItemId.set(requirement.bomItemId, row);
    }
    const parent = requirement.parentRequirementId ? rowByBomItemId.get(requirement.parentRequirementId) : undefined;
    if (parent) {
      parent.children = [...(parent.children ?? []), row];
    } else {
      roots.push(row);
    }
  });

  return roots;
};

export function MaterialRequirementPage() {
  const store = useMesStore();
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    statusFilter: undefined as string | undefined,
  });
  const [form] = Form.useForm<RequirementFormValues>();
  const rows = useMemo(() => store.productionOrders.map((order) => ({
    ...order,
    requirements: store.materialRequirements.filter((item) => item.productionOrderId === order.id),
    requirementTree: buildRequirementTree(store.materialRequirements.filter((item) => item.productionOrderId === order.id)),
  }))
    .filter((order) => !appliedFilters.keyword || `${order.id} ${order.productCode} ${order.salesOrderIds.join(' ')}`.includes(appliedFilters.keyword))
    .filter((order) => !appliedFilters.statusFilter || order.status === appliedFilters.statusFilter), [appliedFilters, store.materialRequirements, store.productionOrders]);
  const editingRequirement = editingRequirementId ? store.materialRequirements.find((item) => item.id === editingRequirementId) : null;

  const openEdit = (requirement: MaterialRequirement) => {
    setEditingRequirementId(requirement.id);
    form.setFieldsValue(requirement);
  };

  const closeEdit = () => {
    setEditingRequirementId(null);
    form.resetFields();
  };

  const handleSave = async () => {
    if (!editingRequirement) return;
    const values = await form.validateFields();
    store.updateMaterialRequirementAction(editingRequirement.id, {
      ...editingRequirement,
      materialCode: values.materialCode,
      materialAttr: values.materialAttr,
      requiredQuantity: Number(values.requiredQuantity ?? 0),
      unit: values.unit,
      feedPort: values.feedPort,
      bomLevel: Number(values.bomLevel ?? editingRequirement.bomLevel),
      bomPath: values.bomPath,
      kitCheckTarget: values.kitCheckTarget ?? false,
    });
    message.success('已更新用料清单');
    closeEdit();
  };

  const handleSearch = () => setAppliedFilters({ keyword, statusFilter });

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setAppliedFilters({ keyword: '', statusFilter: undefined });
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>用料清单</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="MO 单号 / 主产品 / 销售订单" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 320 }} />
          <Select
            allowClear
            placeholder="生产订单状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            options={[
              { value: '未排程', label: '未排程' },
              { value: '已排程', label: '已排程' },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">用料清单</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1100 }}
          expandable={{
            expandedRowRender: (row) => (
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                dataSource={row.requirementTree}
                expandable={{ defaultExpandAllRows: true }}
                scroll={{ x: 1200 }}
                columns={[
                  { title: '子物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) },
                  { title: '层级', dataIndex: 'bomLevel', width: 80 },
                  { title: '属性', dataIndex: 'materialAttr', width: 90 },
                  { title: '用量', dataIndex: 'requiredQuantity', width: 120 },
                  { title: '单位', dataIndex: 'unit', width: 90 },
                  { title: '投料口', dataIndex: 'feedPort', width: 120, render: (v) => v ?? '-' },
                  { title: '是否齐套判断', dataIndex: 'kitCheckTarget', width: 120, render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag> },
                  {
                    title: '操作',
                    width: 100,
                    render: (_, requirement) => <Button type="link" onClick={() => openEdit(requirement)}>编辑</Button>,
                  },
                ]}
              />
            ),
          }}
          columns={[
            { title: '生产订单', dataIndex: 'id', width: 160 },
            { title: '主产品', dataIndex: 'productCode', width: 180, render: (v) => materialName(store, v) },
            { title: '数量', dataIndex: 'quantity', width: 100 },
            { title: '用料项数', dataIndex: 'requirements', width: 110, render: (value) => value.length },
            { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
          ]}
        />
      </Card>

      <Modal
        title="编辑用料清单"
        open={Boolean(editingRequirement)}
        onCancel={closeEdit}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space wrap style={{ width: '100%' }} align="start">
            <Form.Item label="子物料" name="materialCode" rules={[{ required: true, message: '请选择子物料' }]} style={{ width: 220 }}>
              <Select showSearch optionFilterProp="label" options={store.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="属性" name="materialAttr" rules={[{ required: true, message: '请选择属性' }]} style={{ width: 140 }}>
              <Select options={[{ value: '外购', label: '外购' }, { value: '自制', label: '自制' }]} />
            </Form.Item>
            <Form.Item label="用量" name="requiredQuantity" rules={[{ required: true, message: '请输入用量' }]} style={{ width: 140 }}>
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]} style={{ width: 120 }}>
              <Input />
            </Form.Item>
            <Form.Item label="投料口" name="feedPort" style={{ width: 160 }}>
              <Input placeholder="可选" />
            </Form.Item>
            <Form.Item label="层级" name="bomLevel" rules={[{ required: true, message: '请输入层级' }]} style={{ width: 120 }}>
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item label="BOM 路径" name="bomPath" rules={[{ required: true, message: '请输入 BOM 路径' }]} style={{ width: 320 }}>
              <Input />
            </Form.Item>
            <Form.Item label="参与齐套判断" name="kitCheckTarget" valuePropName="checked" style={{ width: 160 }}>
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
