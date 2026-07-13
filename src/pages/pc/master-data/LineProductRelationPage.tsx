import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import type { Key } from 'react';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { SelectedCountText, TableToolIcons } from '../../../components/ListPageTools';
import { useMesStore } from '../../../store/useMesStore';

const DURATION_UNIT_OPTIONS = [
  { value: '分钟', label: '分钟' },
  { value: '小时', label: '小时' },
];

export function LineProductRelationPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<{ productCode: string; lineCode: string } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [lineKeyword, setLineKeyword] = useState('');
  const [productKeyword, setProductKeyword] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>();
  const [enabledFilter, setEnabledFilter] = useState<boolean>();
  const [appliedFilters, setAppliedFilters] = useState({ lineKeyword: '', productKeyword: '', priorityFilter: undefined as string | undefined, enabledFilter: undefined as boolean | undefined });
  const [form] = Form.useForm();
  const lineCode = Form.useWatch('lineCode', form);
  const productCode = Form.useWatch('productCode', form);

  const rows = useMemo(
    () =>
      data.lineProductRelations
        .slice()
        .sort((a, b) => `${a.lineCode}-${a.productCode}`.localeCompare(`${b.lineCode}-${b.productCode}`))
        .map((relation) => {
          const line = data.lines.find((item) => item.code === relation.lineCode);
          const workshop = data.workshops.find((item) => item.code === line?.workshopCode);
          return {
            ...relation,
            key: `${relation.lineCode}__${relation.productCode}`,
            lineName: line?.name ?? '-',
            workshopName: workshop?.name ?? '-',
          };
        }),
    [data.lines, data.lineProductRelations, data.workshops],
  );

  const filteredRows = useMemo(() => rows
    .filter((row) => !appliedFilters.lineKeyword || `${row.lineCode} ${row.lineName}`.includes(appliedFilters.lineKeyword))
    .filter((row) => !appliedFilters.productKeyword || `${row.productCode} ${row.productName}`.includes(appliedFilters.productKeyword))
    .filter((row) => !appliedFilters.priorityFilter || row.productionPriority === appliedFilters.priorityFilter)
    .filter((row) => appliedFilters.enabledFilter === undefined || row.enabled === appliedFilters.enabledFilter), [appliedFilters, rows]);

  const editingRow = useMemo(
    () => (editingKey ? rows.find((item) => item.productCode === editingKey.productCode && item.lineCode === editingKey.lineCode) ?? null : null),
    [editingKey, rows],
  );

  const selectedLine = useMemo(() => data.lines.find((item) => item.code === lineCode), [data.lines, lineCode]);
  const selectedWorkshop = useMemo(() => data.workshops.find((item) => item.code === selectedLine?.workshopCode), [data.workshops, selectedLine]);
  const selectedProduct = useMemo(() => data.materials.find((item) => item.code === productCode), [data.materials, productCode]);

  useEffect(() => {
    if (!open) return;
    if (editingRow) {
      form.setFieldsValue({
        ...editingRow,
        lineName: editingRow.lineName,
        workshopName: editingRow.workshopName,
      });
      return;
    }
    form.setFieldsValue({
      productionPriority: '高',
      singlePotOutput: 50,
      intervalDuration: 0,
      intervalUnit: '小时',
      cleanDuration: 0,
      cleanUnit: '分钟',
      enabled: true,
      createdBy: 'XXX',
      lineName: selectedLine?.name ?? '',
      workshopName: selectedWorkshop?.name ?? '',
      productName: selectedProduct?.name ?? '',
      productSpec: selectedProduct?.spec ?? '',
    });
  }, [editingRow, form, open, selectedLine, selectedProduct, selectedWorkshop]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      lineName: selectedLine?.name ?? '',
      workshopName: selectedWorkshop?.name ?? '',
      productName: selectedProduct?.name ?? '',
      productSpec: selectedProduct?.spec ?? '',
    });
  }, [form, lineCode, open, productCode, selectedLine, selectedProduct, selectedWorkshop]);

  const handleOpenCreate = () => {
    setEditingKey(null);
    form.resetFields();
    form.setFieldsValue({
      productionPriority: '高',
      singlePotOutput: 50,
      intervalDuration: 0,
      intervalUnit: '小时',
      cleanDuration: 0,
      cleanUnit: '分钟',
      enabled: true,
      createdBy: 'XXX',
    });
    setOpen(true);
  };

  const handleOpenEdit = (relation: { productCode: string; lineCode: string }) => {
    setEditingKey(relation);
    setOpen(true);
  };

  const handleCopy = (row: typeof rows[number]) => {
    setEditingKey(null);
    form.resetFields();
    form.setFieldsValue({
      lineCode: row.lineCode,
      lineName: row.lineName,
      workshopName: row.workshopName,
      productCode: `${row.productCode}_COPY`,
      productName: row.productName,
      productSpec: row.productSpec,
      productionPriority: row.productionPriority,
      singlePotOutput: row.singlePotOutput,
      intervalDuration: row.intervalDuration,
      intervalUnit: row.intervalUnit,
      cleanDuration: row.cleanDuration,
      cleanUnit: row.cleanUnit,
      remark: row.remark,
      enabled: row.enabled,
      createdBy: row.createdBy,
    });
    setOpen(true);
  };

  const handleSearch = () => setAppliedFilters({ lineKeyword, productKeyword, priorityFilter, enabledFilter });

  const handleReset = () => {
    setLineKeyword('');
    setProductKeyword('');
    setPriorityFilter(undefined);
    setEnabledFilter(undefined);
    setAppliedFilters({ lineKeyword: '', productKeyword: '', priorityFilter: undefined, enabledFilter: undefined });
  };

  const handleBatchDelete = () => {
    data.batchDeleteLineProductRelationAction(selectedRowKeys.map((key) => {
      const [line, product] = String(key).split('__');
      return { lineCode: line, productCode: product };
    }));
    setSelectedRowKeys([]);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const payload = {
      productCode: values.productCode,
      productName: values.productName,
      productSpec: values.productSpec,
      lineCode: values.lineCode,
      productionPriority: values.productionPriority,
      singlePotOutput: Number(values.singlePotOutput ?? 0),
      intervalDuration: Number(values.intervalDuration ?? 0),
      intervalUnit: values.intervalUnit,
      cleanDuration: Number(values.cleanDuration ?? 0),
      cleanUnit: values.cleanUnit,
      enabled: values.enabled ?? true,
      remark: values.remark,
      createdBy: values.createdBy ?? 'XXX',
      createdAt: editingRow?.createdAt ?? '2025-08-01T09:10:00.000Z',
    };
    if (editingKey) {
      data.editLineProductRelationAction(editingKey, payload);
      message.success('已更新关系');
    } else {
      data.createLineProductRelationAction(payload);
      message.success('已新增关系');
    }
    setOpen(false);
    setEditingKey(null);
    form.resetFields();
  };

  const formatDuration = (value: number, unit: '分钟' | '小时') => `${value}${unit}`;

  return (
    <div className="page">
      <div className="page-title">
        <h2>产线与产品关系表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="产线编码/名称" value={lineKeyword} onChange={(e) => setLineKeyword(e.target.value)} style={{ width: 240 }} />
          <Input allowClear placeholder="产品编码/名称" value={productKeyword} onChange={(e) => setProductKeyword(e.target.value)} style={{ width: 240 }} />
          <Select allowClear placeholder="生产优先级" value={priorityFilter} onChange={setPriorityFilter} style={{ width: 180 }} options={[{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }]} />
          <Select allowClear placeholder="启用状态" value={enabledFilter} onChange={setEnabledFilter} style={{ width: 180 }} options={[{ value: true, label: '启用' }, { value: false, label: '禁用' }]} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">产线与产品关系列表</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的产线与产品关系吗？" onConfirm={handleBatchDelete}>
            <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="key"
          dataSource={filteredRows}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1900 }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 60 },
            { title: '产线编码', dataIndex: 'lineCode', width: 140 },
            { title: '产线名称', dataIndex: 'lineName', width: 140 },
            { title: '所属车间', dataIndex: 'workshopName', width: 120 },
            { title: '产品编码', dataIndex: 'productCode', width: 140 },
            { title: '产品名称', dataIndex: 'productName', width: 140 },
            { title: '产品规格', dataIndex: 'productSpec', width: 140 },
            { title: '生产优先级', dataIndex: 'productionPriority', width: 120 },
            { title: '单锅产量', dataIndex: 'singlePotOutput', width: 120 },
            { title: '单锅标准工作时长', width: 130, render: (_, row) => formatDuration(row.intervalDuration, row.intervalUnit) },
            { title: '清机时长', width: 130, render: (_, row) => formatDuration(row.cleanDuration, row.cleanUnit) },
            { title: '启用状态', dataIndex: 'enabled', width: 100, render: (v) => <span style={{ color: v ? '#52c41a' : '#999' }}>{v ? '启用' : '禁用'}</span> },
            { title: '备注', dataIndex: 'remark', width: 180, render: (v) => v ?? '-' },
            { title: '创建人', dataIndex: 'createdBy', width: 100, render: (v) => v ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
            {
              title: '操作',
              width: 140,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => handleCopy(row)}>复制</Button>
                  <Button type="link" onClick={() => handleOpenEdit({ productCode: row.productCode, lineCode: row.lineCode })}>编辑</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingKey ? '编辑' : '新增'}
        open={open}
        onCancel={() => { setOpen(false); setEditingKey(null); form.resetFields(); }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={1100}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ productionPriority: '高', singlePotOutput: 50, intervalDuration: 0, intervalUnit: '小时', cleanDuration: 0, cleanUnit: '分钟', enabled: true, createdBy: 'XXX' }}
        >
          <div style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="产线编码" name="lineCode" rules={[{ required: true, message: '请选择产线编码' }]} style={{ width: 300 }}>
                <Select placeholder="点击选择" options={data.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item label="产线名称" name="lineName" style={{ width: 300 }}>
                <Input placeholder="自动代入" disabled />
              </Form.Item>
              <Form.Item label="所属车间" name="workshopName" style={{ width: 300 }}>
                <Input placeholder="自动代入" disabled />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="产品编码" name="productCode" rules={[{ required: true, message: '请输入产品编码' }]} style={{ width: 300 }}>
                <Select placeholder="点击选择" options={data.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item label="产品名称" name="productName" style={{ width: 300 }}>
                <Input placeholder="自动代入" disabled />
              </Form.Item>
              <Form.Item label="产品规格" name="productSpec" style={{ width: 300 }}>
                <Input placeholder="自动代入" disabled />
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="生产优先级" name="productionPriority" style={{ width: 220 }}>
                <Select options={[{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }]} />
              </Form.Item>
              <Form.Item label="单锅产量" name="singlePotOutput" rules={[{ required: true, message: '请输入单锅产量' }]} style={{ width: 220 }}>
                <Input type="number" min={1} placeholder="输入，正数" />
              </Form.Item>
              <Form.Item label="单锅标准工作时长" style={{ width: 220 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="intervalDuration" rules={[{ required: true, message: '请输入间歇时长' }]} noStyle>
                    <Input type="number" min={0} placeholder="输入" />
                  </Form.Item>
                  <Form.Item name="intervalUnit" noStyle>
                    <Select style={{ width: 92 }} options={DURATION_UNIT_OPTIONS} />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
              <Form.Item label="清机时长" style={{ width: 220 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="cleanDuration" rules={[{ required: true, message: '请输入清机时长' }]} noStyle>
                    <Input type="number" min={0} placeholder="输入" />
                  </Form.Item>
                  <Form.Item name="cleanUnit" noStyle>
                    <Select style={{ width: 92 }} options={DURATION_UNIT_OPTIONS} />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            </Space>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="创建人" name="createdBy" style={{ width: 300 }}>
                <Input placeholder="默认为当前用户" disabled />
              </Form.Item>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" style={{ width: 220 }}>
                <Switch checkedChildren="启用" unCheckedChildren="禁用" defaultChecked />
              </Form.Item>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
