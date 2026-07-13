import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { SelectedCountText, TableToolIcons } from '../../../components/ListPageTools';
import { createSeedData } from '../../../mock/seedData';
import type { Key } from 'react';
import type { BomHeader, BomItem } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';
import { materialName } from '../../../utils/display';

type BomHeaderFormValues = Omit<BomHeader, 'status'> & { status: BomHeader['status']; isStandard: true };
type BomItemFormValues = BomItem;
type PageMode = 'list' | 'form';

type ListFilterValues = {
  bomCode: string;
  version: string;
  productCode: string;
  productName: string;
};

const statusOptions: Array<{ value: BomHeader['status']; label: string }> = [
  { value: '草稿', label: '草稿' },
  { value: '生效', label: '生效' },
  { value: '停用', label: '停用' },
];

const attrOptions = [
  { value: '外购', label: '外购' },
  { value: '自制', label: '自制' },
] as const;

const defaultFilters: ListFilterValues = {
  bomCode: '',
  version: '',
  productCode: '',
  productName: '',
};

const createDefaultHeader = (data: ReturnType<typeof useMesStore.getState>): BomHeaderFormValues => ({
  code: `BOM-${Date.now()}`,
  productCode: data.materials.find((item) => item.type === '主产品')?.code ?? data.materials[0]?.code ?? 'PROD-A',
  version: 'V1',
  status: '草稿',
  isStandard: true,
  remark: '',
  createdAt: new Date().toISOString(),
});

const createDefaultItem = (data: ReturnType<typeof useMesStore.getState>, bomCode: string, productCode: string, parentId?: string): BomItemFormValues => ({
  id: `BOMI-${Date.now()}`,
  bomCode,
  productCode,
  materialCode: data.materials[0]?.code ?? 'MAT-PP',
  materialAttr: '外购',
  quantityPerUnit: 0,
  feedPort: '',
  parentId,
  sortOrder: 1,
});

const collectBomItemIds = (items: BomItem[], ids: string[]) => {
  const removal = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    items.forEach((item) => {
      if (item.parentId && removal.has(item.parentId) && !removal.has(item.id)) {
        removal.add(item.id);
        changed = true;
      }
    });
  }
  return removal;
};

export function BomPage() {
  const data = useMesStore();
  const [mode, setMode] = useState<PageMode>('list');
  const [headerForm] = Form.useForm<BomHeaderFormValues>();
  const [itemForm] = Form.useForm<BomItemFormValues>();
  const [filterForm] = Form.useForm<ListFilterValues>();
  const watchedHeaderProductCode = Form.useWatch('productCode', headerForm);
  const watchedItemMaterialCode = Form.useWatch('materialCode', itemForm);
  const [draftHeaderCode, setDraftHeaderCode] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<BomItem[]>([]);
  const [selectedHeaderCodes, setSelectedHeaderCodes] = useState<string[]>([]);
  const [selectedDraftItemIds, setSelectedDraftItemIds] = useState<string[]>([]);
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemParentId, setItemParentId] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<ListFilterValues>(defaultFilters);

  const headers = data.bomHeaders;
  const seedData = createSeedData();
  const seedHeader = seedData.bomHeaders[0];
  const seedProductCode = seedHeader?.productCode ?? 'PROD-A';
  const currentHeader = draftHeaderCode ? headers.find((item) => item.code === draftHeaderCode) : null;
  const formHeader = currentHeader ?? createDefaultHeader(data);
  const currentHeaderProductCode = watchedHeaderProductCode || formHeader.productCode || seedProductCode || data.materials.find((item) => item.type === '主产品')?.code || data.materials[0]?.code || 'PROD-A';
  const currentProduct = data.materials.find((item) => item.code === currentHeaderProductCode);
  const currentItemMaterial = data.materials.find((item) => item.code === watchedItemMaterialCode);

  useEffect(() => {
    if (mode !== 'form') return;
    const nextHeader = draftHeaderCode
      ? headers.find((item) => item.code === draftHeaderCode)
      : createDefaultHeader(data);

    if (!nextHeader) return;
    headerForm.setFieldsValue({ ...nextHeader, isStandard: true });
  }, [data, draftHeaderCode, headerForm, headers, mode]);


  const listRows = useMemo(() => headers
    .filter((header): header is BomHeader => Boolean(header && header.code && header.productCode && header.version && header.status))
    .map((header) => {
      const product = data.materials.find((item) => item.code === header.productCode);
      return {
        key: header.code,
        code: header.code,
        version: header.version,
        productCode: header.productCode,
        productName: product?.name ?? '-',
        productSpec: product?.spec ?? '-',
        productType: product?.type ?? '-',
        productionUnit: product?.productionUnit ?? product?.baseUnit ?? '-',
        status: header.status,
        remark: header.remark ?? '-',
        createdBy: '系统',
        createdAt: header.createdAt ?? '-',
        itemCount: data.bomItems.filter((item) => item.bomCode === header.code).length,
      };
    }).filter((row) => {
      const matches = (value: string, keyword: string) => !keyword || value.includes(keyword);
      return matches(row.code, filters.bomCode)
        && matches(row.version, filters.version)
        && matches(row.productCode, filters.productCode)
        && matches(row.productName, filters.productName);
    }), [data.bomItems, data.materials, filters, headers]);

  const treeData = useMemo(() => {
    const build = (parentId?: string): Array<BomItem & { key: string; children?: Array<BomItem & { key: string }> }> => draftItems
      .filter((item) => (item.parentId ?? undefined) === (parentId ?? undefined))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((item) => ({
        ...item,
        key: item.id,
        children: build(item.id),
      }));
    return build();
  }, [draftItems]);

  const openCreateHeader = () => {
    setDraftHeaderCode(null);
    setDraftItems([]);
    setSelectedDraftItemIds([]);
    headerForm.resetFields();
    setMode('form');
  };

  const openEditHeader = (headerCode: string) => {
    const header = headers.find((item) => item.code === headerCode);
    if (!header) return;
    setDraftHeaderCode(headerCode);
    setDraftItems(data.bomItems.filter((item) => item.bomCode === headerCode));
    setSelectedDraftItemIds([]);
    headerForm.resetFields();
    setMode('form');
  };

  const handleSearch = async () => {
    const next = await filterForm.validateFields().catch(() => filterForm.getFieldsValue());
    setFilters({
      bomCode: next.bomCode ?? '',
      version: next.version ?? '',
      productCode: next.productCode ?? '',
      productName: next.productName ?? '',
    });
  };

  const handleReset = () => {
    filterForm.resetFields();
    setFilters(defaultFilters);
  };

  const handleBatchDeleteHeaders = () => {
    if (!selectedHeaderCodes.length) return;
    useMesStore.setState({
      bomHeaders: data.bomHeaders.filter((item) => !selectedHeaderCodes.includes(item.code)),
      bomItems: data.bomItems.filter((item) => !selectedHeaderCodes.includes(item.bomCode)),
    });
    setSelectedHeaderCodes([]);
    message.success('已批量删除 BOM');
  };

  const handleCloseForm = () => {
    setMode('list');
    setDraftHeaderCode(null);
    setDraftItems([]);
    setSelectedDraftItemIds([]);
    setItemOpen(false);
    setEditingItemId(null);
    setItemParentId(undefined);
    headerForm.resetFields();
    itemForm.resetFields();
  };

  const handleSaveHeader = async () => {
    const values = await headerForm.validateFields();
    const headerPayload: BomHeader = {
      code: values.code || createSeedData().bomHeaders[0]?.code || `BOM-${Date.now()}`,
      productCode: values.productCode || createSeedData().bomHeaders[0]?.productCode || 'PROD-A',
      version: values.version || 'V1',
      status: values.status || '草稿',
      isStandard: true,
      remark: values.remark,
      createdAt: values.createdAt ?? new Date().toISOString(),
    };

    const nextItems = draftItems.map((item) => ({
      ...item,
      bomCode: headerPayload.code,
      productCode: headerPayload.productCode,
    }));

    if (draftHeaderCode) {
      data.updateBomHeaderAction(draftHeaderCode, headerPayload, nextItems);
    } else {
      data.createBomHeaderAction(headerPayload, nextItems);
    }

    filterForm.resetFields();
    setFilters(defaultFilters);
    setSelectedHeaderCodes([]);
    setDraftHeaderCode(null);
    setDraftItems([]);
    setSelectedDraftItemIds([]);
    headerForm.resetFields();
    setMode('list');
    requestAnimationFrame(() => setMode('list'));
    message.success(draftHeaderCode ? '已更新标准 BOM' : '已新增标准 BOM');
  };

  const openCreateItem = (parent?: BomItem) => {
    const header = headerForm.getFieldsValue();
    const bomCode = header.code || currentHeader?.code || createDefaultHeader(data).code;
    const productCode = header.productCode || currentHeader?.productCode || currentHeaderProductCode;
    const nextValues = createDefaultItem(data, bomCode, productCode, parent?.id);
    setEditingItemId(null);
    setItemParentId(parent?.id);
    itemForm.resetFields();
    itemForm.setFieldsValue(nextValues);
    setItemOpen(true);
  };

  const openEditItem = (item: BomItem) => {
    setEditingItemId(item.id);
    setItemParentId(item.parentId);
    itemForm.resetFields();
    itemForm.setFieldsValue(item);
    setItemOpen(true);
  };

  const handleSaveItem = async () => {
    const values = await itemForm.validateFields();
    const payload: BomItem = {
      id: values.id || `BOMI-${Date.now()}`,
      bomCode: values.bomCode || createSeedData().bomHeaders[0]?.code || 'BOM-PROD-A',
      productCode: values.productCode || createSeedData().bomHeaders[0]?.productCode || 'PROD-A',
      materialCode: values.materialCode || createSeedData().materials[0]?.code || 'MAT-PP',
      materialAttr: values.materialAttr || '外购',
      quantityPerUnit: Number(values.quantityPerUnit ?? 0),
      feedPort: values.feedPort,
      parentId: values.parentId,
      sortOrder: Number(values.sortOrder ?? 0),
    };

    setDraftItems((current) => (
      editingItemId
        ? current.map((item) => item.id === editingItemId ? payload : item)
        : [...current.filter((item) => item.id !== payload.id), payload]
    ));
    setItemOpen(false);
    setEditingItemId(null);
    setItemParentId(undefined);
    itemForm.resetFields();
    message.success(editingItemId ? '已更新 BOM 子项' : '已新增 BOM 子项');
  };

  const handleDeleteItem = (id: string) => {
    const removal = collectBomItemIds(draftItems, [id]);
    setDraftItems((current) => current.filter((item) => !removal.has(item.id)));
    setSelectedDraftItemIds((current) => current.filter((itemId) => !removal.has(itemId)));
    message.success('已删除 BOM 子项');
  };

  const handleBatchDeleteItems = () => {
    if (!selectedDraftItemIds.length) return;
    const removal = collectBomItemIds(draftItems, selectedDraftItemIds);
    setDraftItems((current) => current.filter((item) => !removal.has(item.id)));
    setSelectedDraftItemIds([]);
    message.success('已批量删除 BOM 子项');
  };

  const listSelection = {
    selectedRowKeys: selectedHeaderCodes,
    onChange: (keys: React.Key[]) => setSelectedHeaderCodes(keys.map(String)),
  };

  const draftSelection = {
    selectedRowKeys: selectedDraftItemIds,
    onChange: (keys: React.Key[]) => setSelectedDraftItemIds(keys.map(String)),
  };

  const itemColumns = [
    { title: '物料编码-子项', dataIndex: 'materialCode', render: (value: string) => materialName(data, value) },
    { title: '物料名称-子项', dataIndex: 'materialCode', render: (value: string) => materialName(data, value) },
    { title: '物料规格-子项', dataIndex: 'materialCode', render: (value: string) => data.materials.find((item) => item.code === value)?.spec ?? '-' },
    { title: '物料种类-子项', dataIndex: 'materialCode', render: (value: string) => data.materials.find((item) => item.code === value)?.type ?? '-' },
    { title: '用量单位', dataIndex: 'materialCode', render: (value: string) => data.materials.find((item) => item.code === value)?.productionUnit ?? data.materials.find((item) => item.code === value)?.baseUnit ?? '-' },
    { title: '用量：分子', dataIndex: 'quantityPerUnit' },
    { title: '用量：分母', dataIndex: 'quantityPerUnit', render: () => '1' },
    { title: '固定损耗', dataIndex: 'fixedLoss', render: () => '-' },
    { title: '误差上限%', dataIndex: 'upperTolerance', render: () => '-' },
    { title: '误差下限%', dataIndex: 'lowerTolerance', render: () => '-' },
    { title: '投料口', dataIndex: 'feedPort', render: (value: string) => value || '-' },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, row: BomItem & { key: string }) => (
        <Space>
          <Button type="link" onClick={() => openCreateItem(row)}>增加替代物料</Button>
          <Button type="link" onClick={() => openEditItem(row)}>编辑</Button>
          <Popconfirm title="确定删除这个子项吗？" onConfirm={() => handleDeleteItem(row.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const coProductColumns = [
    { title: '物料编码-联副产品', dataIndex: 'materialCode', render: () => '-' },
    { title: '物料名称-联副产品', dataIndex: 'materialCode', render: () => '-' },
    { title: '物料规格-联副产品', dataIndex: 'materialCode', render: () => '-' },
    { title: '物料种类-联副产品', dataIndex: 'materialCode', render: () => '-' },
    { title: '用量单位', dataIndex: 'materialCode', render: () => '-' },
    { title: '用量：分子', dataIndex: 'materialCode', render: () => '-' },
    { title: '用量：分母', dataIndex: 'materialCode', render: () => '-' },
    { title: '固定损耗', dataIndex: 'materialCode', render: () => '-' },
    { title: '误差上限%', dataIndex: 'materialCode', render: () => '-' },
    { title: '误差下限%', dataIndex: 'materialCode', render: () => '-' },
    { title: '备注', dataIndex: 'materialCode', render: () => '-' },
    {
      title: '操作',
      width: 220,
      render: () => (
        <Space>
          <Button type="link" onClick={() => message.info('联副产品暂未接入')}>新增联副产品</Button>
          <Button type="link" onClick={() => message.info('联副产品暂未接入')}>编辑</Button>
          <Button type="link" danger onClick={() => message.info('联副产品暂未接入')}>删除</Button>
        </Space>
      ),
    },
  ];

  if (mode === 'list') {
    return (
      <div className="page">
        <div className="page-title">
          <h2>物料清单</h2>
        </div>

        <Card className="filter-card">
          <Form form={filterForm} layout="inline" initialValues={defaultFilters}>
            <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Form.Item name="bomCode" style={{ marginBottom: 0 }}>
                  <Input placeholder="BOM编码" style={{ width: 180 }} />
                </Form.Item>
                <Form.Item name="version" style={{ marginBottom: 0 }}>
                  <Input placeholder="BOM版本号" style={{ width: 180 }} />
                </Form.Item>
                <Form.Item name="productCode" style={{ marginBottom: 0 }}>
                  <Input placeholder="物料编码-父级" style={{ width: 180 }} />
                </Form.Item>
                <Form.Item name="productName" style={{ marginBottom: 0 }}>
                  <Input placeholder="物料名称-父级" style={{ width: 180 }} />
                </Form.Item>
              </Space>
              <Space>
                <Button type="primary" onClick={handleSearch}>查询</Button>
                <Button onClick={handleReset}>重置</Button>
                <Button type="link" onClick={() => message.info('更多筛选暂未实现')}>展开</Button>
              </Space>
            </Space>
          </Form>
        </Card>

        <div className="table-toolbar">
          <div className="table-toolbar-title">数据列表</div>
          <div className="table-actions">
            <SelectedCountText selectedCount={selectedHeaderCodes.length} />
            <Button type="primary" onClick={openCreateHeader}>新增</Button>
            <Button danger type="primary" disabled={!selectedHeaderCodes.length} onClick={handleBatchDeleteHeaders}>批量删除</Button>
            <Button onClick={() => message.info('导入数据暂未实现')}>导入</Button>
            <Button onClick={() => message.info('导出数据暂未实现')}>批量导出</Button>
            <TableToolIcons />
          </div>
        </div>

        <Card className="demo-card list-card">
          <Table
            rowKey="key"
            dataSource={listRows}
            pagination={false}
            rowSelection={{ ...listSelection, columnWidth: 48 }}
            scroll={{ x: 1700 }}
            columns={[
              { title: '序号', width: 72, render: (_: unknown, __: unknown, index: number) => index + 1 },
              { title: 'BOM编码', dataIndex: 'code', width: 150 },
              { title: 'BOM版本号', dataIndex: 'version', width: 120 },
              { title: '物料编码-父级', dataIndex: 'productCode', width: 160 },
              { title: '物料名称-父级', dataIndex: 'productName', width: 180 },
              { title: '物料规格-父级', dataIndex: 'productSpec', width: 150 },
              { title: '物料种类-父级', dataIndex: 'productType', width: 150 },
              { title: '生产单位', dataIndex: 'productionUnit', width: 120 },
              { title: '启用状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={value === '生效' ? 'green' : value === '停用' ? 'default' : 'blue'}>{value}</Tag> },
              { title: '备注', dataIndex: 'remark', width: 160 },
              { title: '创建人', dataIndex: 'createdBy', width: 120 },
              { title: '创建时间', dataIndex: 'createdAt', width: 170 },
              {
                title: '操作',
                width: 150,
                fixed: 'right',
                render: (_: unknown, row: { code: string }) => (
                  <Space>
                    <Button type="link" onClick={() => openEditHeader(row.code)}>详情</Button>
                    <Button type="link" onClick={() => openEditHeader(row.code)}>更多</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-title">
        <h2>{draftHeaderCode ? '编辑' : '新增'}</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">BOM 维护</div>
        <div className="table-actions">
          <Button onClick={handleCloseForm}>返回列表</Button>
        </div>
      </div>

      <Card className="demo-card">
        <Form key={draftHeaderCode || 'new-bom'} form={headerForm} layout="vertical" initialValues={formHeader}>
          <Space wrap style={{ width: '100%' }} align="start">
            <Form.Item label="*BOM编码" name="code" rules={[{ required: true, message: '请输入 BOM 编码' }]} style={{ width: 220 }}>
              <Input placeholder="输入，唯一" disabled={Boolean(draftHeaderCode)} value={formHeader.code} />
            </Form.Item>
            <Form.Item label="*BOM版本号" name="version" rules={[{ required: true, message: '请输入版本号' }]} style={{ width: 220 }}>
              <Input placeholder="输入" value={formHeader.version} />
            </Form.Item>
            <Form.Item label="*物料编码-父级" name="productCode" rules={[{ required: true, message: '请选择父级物料' }]} style={{ width: 220 }}>
              <Select options={data.materials.filter((item) => item.type === '主产品').map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} value={formHeader.productCode} />
            </Form.Item>
            <Form.Item label="*物料名称-父级" style={{ width: 220 }}>
              <Input value={currentProduct?.name ?? ''} disabled placeholder="自动代入" />
            </Form.Item>
            <Form.Item label="物料规格" style={{ width: 220 }}>
              <Input value={currentProduct?.spec ?? ''} disabled placeholder="自动代入" />
            </Form.Item>
            <Form.Item label="物料种类" style={{ width: 220 }}>
              <Input value={currentProduct?.type ?? ''} disabled placeholder="自动代入" />
            </Form.Item>
            <Form.Item label="*生产单位" style={{ width: 220 }}>
              <Input value={currentProduct?.productionUnit ?? currentProduct?.baseUnit ?? ''} disabled placeholder="自动代入" />
            </Form.Item>
            <Form.Item label="备注" name="remark" style={{ width: 220 }}>
              <Input placeholder="输入" value={formHeader.remark} />
            </Form.Item>
            <Form.Item label="*启用状态" name="status" rules={[{ required: true, message: '请选择状态' }]} style={{ width: 220 }}>
              <Select options={statusOptions} value={formHeader.status} />
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card className="demo-card list-card">
        <Tabs
          defaultActiveKey="children"
          items={[
            {
              key: 'children',
              label: '子项物料',
              children: (
                <>
                  <div className="table-toolbar">
                    <div className="table-toolbar-title">子项物料</div>
                    <div className="table-actions">
                      <SelectedCountText selectedCount={selectedDraftItemIds.length} />
                      <Button type="primary" onClick={() => openCreateItem()}>添加物料</Button>
                      <Button danger type="primary" disabled={!selectedDraftItemIds.length} onClick={handleBatchDeleteItems}>批量删除</Button>
                      <TableToolIcons />
                    </div>
                  </div>
                  <Table
                    rowKey="id"
                    dataSource={treeData}
                    pagination={false}
                    rowSelection={{ ...draftSelection, columnWidth: 48 }}
                    expandable={{ defaultExpandAllRows: true }}
                    scroll={{ x: 1800 }}
                    columns={itemColumns}
                  />
                </>
              ),
            },
            {
              key: 'co-product',
              label: '联副产品',
              children: (
                <>
                  <div className="table-toolbar">
                    <div className="table-toolbar-title">联副产品</div>
                    <div className="table-actions">
                      <Button type="primary" onClick={() => message.info('联副产品暂未接入')}>添加联副产品</Button>
                      <TableToolIcons />
                    </div>
                  </div>
                  <Table
                    rowKey="id"
                    dataSource={[]}
                    pagination={false}
                    scroll={{ x: 1800 }}
                    columns={coProductColumns}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
        <Button style={{ width: 120 }} onClick={handleCloseForm}>取消</Button>
        <Button type="primary" style={{ width: 120 }} onClick={handleSaveHeader}>保存</Button>
      </div>

      <Modal
        title={editingItemId ? '编辑 BOM 子项' : '添加物料'}
        open={itemOpen}
        onCancel={() => { setItemOpen(false); setEditingItemId(null); setItemParentId(undefined); itemForm.resetFields(); }}
        onOk={handleSaveItem}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={1000}
      >
        <Form form={itemForm} layout="vertical">
          <Space wrap style={{ width: '100%' }} align="start">
            <Form.Item label="物料编码-子项" name="materialCode" rules={[{ required: true, message: '请选择子物料' }]} style={{ width: 220 }}>
              <Select options={data.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="物料名称-子项" style={{ width: 220 }}>
              <Input value={currentItemMaterial?.name ?? ''} disabled placeholder="自动写入" />
            </Form.Item>
            <Form.Item label="物料规格-子项" style={{ width: 220 }}>
              <Input value={currentItemMaterial?.spec ?? ''} disabled placeholder="自动写入" />
            </Form.Item>
            <Form.Item label="物料种类-子项" style={{ width: 220 }}>
              <Input value={currentItemMaterial?.type ?? ''} disabled placeholder="自动写入" />
            </Form.Item>
            <Form.Item label="子项属性" name="materialAttr" rules={[{ required: true, message: '请选择子项属性' }]} style={{ width: 220 }}>
              <Select options={[...attrOptions]} />
            </Form.Item>
            <Form.Item label="用量单位" style={{ width: 220 }}>
              <Input value={currentItemMaterial?.productionUnit ?? currentItemMaterial?.baseUnit ?? ''} disabled placeholder="自动写入" />
            </Form.Item>
            <Form.Item label="用量：分子" name="quantityPerUnit" rules={[{ required: true, message: '请输入用量分子' }]} style={{ width: 220 }}>
              <Input type="number" min={0} step="0.0001" />
            </Form.Item>
            <Form.Item label="用量：分母" style={{ width: 220 }}>
              <Input value="1" disabled />
            </Form.Item>
            <Form.Item label="固定损耗" style={{ width: 220 }}>
              <Input placeholder="自动写入" disabled />
            </Form.Item>
            <Form.Item label="误差上限%" style={{ width: 220 }}>
              <Input placeholder="自动写入" disabled />
            </Form.Item>
            <Form.Item label="误差下限%" style={{ width: 220 }}>
              <Input placeholder="自动写入" disabled />
            </Form.Item>
            <Form.Item label="投料口" name="feedPort" style={{ width: 220 }}>
              <Input placeholder="输入，可选" />
            </Form.Item>
            <Form.Item label="上级节点" name="parentId" style={{ width: 220 }}>
              <Select
                allowClear
                placeholder="可选"
                options={draftItems
                  .filter((item) => item.id !== editingItemId)
                  .map((item) => ({ value: item.id, label: `${materialName(data, item.materialCode)} (${item.id})` }))}
              />
            </Form.Item>
            <Form.Item label="明细编号" name="id" rules={[{ required: true, message: '请输入明细编号' }]} style={{ width: 220 }}>
              <Input disabled={Boolean(editingItemId)} placeholder="输入，唯一" />
            </Form.Item>
            <Form.Item label="排序" name="sortOrder" style={{ width: 220 }}>
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="BOM编码" name="bomCode" style={{ width: 220 }}>
              <Input disabled />
            </Form.Item>
            <Form.Item label="父级物料" name="productCode" style={{ width: 220 }}>
              <Input disabled />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
