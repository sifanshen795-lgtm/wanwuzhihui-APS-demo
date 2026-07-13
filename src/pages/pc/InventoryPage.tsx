import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { Key } from 'react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { ListPageFooter, SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import type { InventoryItem, InventoryKind, InventoryLocation } from '../../domain/models/mes';
import { getInventoryLocation, getMaterialInventorySummary } from '../../domain/services/inventoryReservationService';
import { getLineSideInventoryQuantity } from '../../domain/services/mrpService';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

const kindTitleMap: Record<InventoryKind, string> = {
  即时库存: '即时库存',
  预计入库: '预计入库登记',
  预计出库: '预计出库登记',
};

type InventoryPageProps = {
  kind?: InventoryKind;
  title?: string;
  location?: InventoryLocation;
};

type InventoryFormValues = {
  id: string;
  materialCode: string;
  materialType: InventoryItem['materialType'];
  batchNo: string;
  quantity: number;
  unit: string;
  source: InventoryItem['source'];
  inventoryKind: InventoryKind;
  inventoryLocation: InventoryLocation;
  plannedDate?: Dayjs;
  updatedAt?: Dayjs;
};

type InventoryTableRow = InventoryItem & {
  sourceLabel?: string;
};

export function InventoryPage({ kind = '即时库存', title = kindTitleMap[kind], location = '仓库' }: InventoryPageProps) {
  const store = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [materialKeyword, setMaterialKeyword] = useState('');
  const [batchKeyword, setBatchKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<InventoryItem['source']>();
  const [appliedFilters, setAppliedFilters] = useState({ materialKeyword: '', batchKeyword: '', sourceFilter: undefined as InventoryItem['source'] | undefined });
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<InventoryFormValues>();
  const isBarcodeSourcedImmediate = kind === '即时库存' && location === '仓库';
  const isLineSideSourcedImmediate = kind === '即时库存' && location === '线边仓';
  const isReadOnlyImmediate = isBarcodeSourcedImmediate || isLineSideSourcedImmediate;

  const rows = useMemo<InventoryTableRow[]>(() => {
    if (isBarcodeSourcedImmediate) {
      const grouped = new Map<string, InventoryTableRow>();
      store.barcodes
        .filter((barcode) => (barcode.inventoryStatus ?? '库内') === '库内')
        .forEach((barcode) => {
          const material = store.materials.find((item) => item.code === barcode.materialCode);
          const current = grouped.get(barcode.materialCode);
          const updatedAt = current && current.updatedAt > barcode.createdAt ? current.updatedAt : barcode.createdAt;
          grouped.set(barcode.materialCode, {
            id: `INV-BARCODE-${barcode.materialCode}`,
            materialCode: barcode.materialCode,
            materialType: material?.type ?? barcode.type,
            batchNo: '',
            quantity: Number(((current?.quantity ?? 0) + barcode.remainingQuantity).toFixed(2)),
            unit: material?.inventoryUnit ?? material?.baseUnit ?? barcode.unit,
            source: 'MES',
            sourceLabel: '条码档案',
            inventoryKind: '即时库存',
            inventoryLocation: '仓库',
            updatedAt,
          });
        });
      return Array.from(grouped.values())
        .filter((item) => !appliedFilters.materialKeyword || `${item.materialCode} ${materialName(store, item.materialCode)}`.includes(appliedFilters.materialKeyword))
        .sort((a, b) => a.materialCode.localeCompare(b.materialCode));
    }

    if (isLineSideSourcedImmediate) {
      const materialCodes = new Set<string>();
      store.barcodes
        .filter((barcode) => barcode.inventoryStatus === '库外')
        .forEach((barcode) => materialCodes.add(barcode.materialCode));
      store.tanks.forEach((tank) => materialCodes.add(tank.materialCode));

      return Array.from(materialCodes)
        .map((materialCode) => {
          const material = store.materials.find((item) => item.code === materialCode);
          const barcodeQuantity = store.barcodes
            .filter((barcode) => barcode.materialCode === materialCode && barcode.inventoryStatus === '库外')
            .reduce((sum, barcode) => Number((sum + barcode.remainingQuantity).toFixed(2)), 0);
          const tankQuantity = store.tanks
            .filter((tank) => tank.materialCode === materialCode)
            .reduce((sum, tank) => Number((sum + tank.currentQuantity).toFixed(2)), 0);
          const sourceLabels = [
            barcodeQuantity > 0 ? '条码档案' : undefined,
            tankQuantity > 0 ? '储罐档案' : undefined,
          ].filter(Boolean).join(' / ');
          return {
            id: `INV-LINE-SIDE-${materialCode}`,
            materialCode,
            materialType: material?.type ?? '原料',
            batchNo: '',
            quantity: getLineSideInventoryQuantity(store, materialCode),
            unit: material?.inventoryUnit ?? material?.baseUnit ?? 'kg',
            source: 'MES',
            sourceLabel: sourceLabels || '条码档案 / 储罐档案',
            inventoryKind: '即时库存',
            inventoryLocation: '线边仓',
            updatedAt: '-',
          } satisfies InventoryTableRow;
        })
        .filter((item) => item.quantity > 0)
        .filter((item) => !appliedFilters.materialKeyword || `${item.materialCode} ${materialName(store, item.materialCode)}`.includes(appliedFilters.materialKeyword))
        .sort((a, b) => a.materialCode.localeCompare(b.materialCode));
    }

    return store.inventory
      .filter((item) => (item.inventoryKind ?? '即时库存') === kind)
      .filter((item) => getInventoryLocation(item) === location)
      .filter((item) => !appliedFilters.materialKeyword || `${item.materialCode} ${materialName(store, item.materialCode)}`.includes(appliedFilters.materialKeyword))
      .filter((item) => kind === '即时库存' || !appliedFilters.batchKeyword || item.batchNo.includes(appliedFilters.batchKeyword))
      .filter((item) => !appliedFilters.sourceFilter || item.source === appliedFilters.sourceFilter);
  }, [appliedFilters, isBarcodeSourcedImmediate, isLineSideSourcedImmediate, kind, location, store]);
  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = useMemo(() => rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [effectivePage, rows]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters.batchKeyword, appliedFilters.materialKeyword, appliedFilters.sourceFilter, kind]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      id: `INV-${kind}-${Date.now()}`,
      materialCode: store.materials[0]?.code,
      materialType: store.materials[0]?.type,
      batchNo: '',
      quantity: 0,
      unit: store.materials[0]?.inventoryUnit ?? store.materials[0]?.baseUnit ?? 'kg',
      source: '手动',
      inventoryKind: kind,
      inventoryLocation: location,
      plannedDate: kind === '即时库存' ? undefined : dayjs(),
      updatedAt: dayjs(),
    });
    setOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    form.setFieldsValue({
      id: item.id,
      materialCode: item.materialCode,
      materialType: item.materialType,
      batchNo: item.batchNo,
      quantity: item.quantity,
      unit: item.unit,
      source: item.source,
      inventoryKind: item.inventoryKind,
      inventoryLocation: getInventoryLocation(item),
      plannedDate: item.plannedDate ? dayjs(item.plannedDate) : undefined,
      updatedAt: dayjs(item.updatedAt),
    });
    setOpen(true);
  };

  const submit = () => {
    const values = form.getFieldsValue();
    const payload: InventoryItem = {
      id: values.id,
      materialCode: values.materialCode,
      materialType: values.materialType,
      batchNo: values.batchNo ?? '',
      plannedDate: kind === '即时库存' ? undefined : values.plannedDate?.format('YYYY-MM-DD'),
      quantity: Number(values.quantity),
      unit: values.unit,
      source: values.source,
      inventoryKind: kind,
      inventoryLocation: location,
      updatedAt: values.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
    if (editingId) {
      store.editInventoryAction(editingId, payload);
      message.success('已更新库存记录');
    } else {
      store.createInventoryAction(payload);
      message.success('已新增库存记录');
    }
    setOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleSearch = () => setAppliedFilters({ materialKeyword, batchKeyword, sourceFilter });

  const handleReset = () => {
    setMaterialKeyword('');
    setBatchKeyword('');
    setSourceFilter(undefined);
    setAppliedFilters({ materialKeyword: '', batchKeyword: '', sourceFilter: undefined });
  };

  const handleBatchDelete = () => {
    selectedRowKeys.map(String).forEach(store.deleteInventoryAction);
    setSelectedRowKeys([]);
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>{title}</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="物料编码/名称" value={materialKeyword} onChange={(e) => setMaterialKeyword(e.target.value)} style={{ width: 260 }} />
          {kind !== '即时库存' ? (
            <Input allowClear placeholder="批号" value={batchKeyword} onChange={(e) => setBatchKeyword(e.target.value)} style={{ width: 220 }} />
          ) : null}
          {!isReadOnlyImmediate ? (
            <Select allowClear placeholder="来源" value={sourceFilter} onChange={setSourceFilter} style={{ width: 180 }} options={[{ value: '手动', label: '手动' }, { value: 'ERP', label: 'ERP' }, { value: 'MES', label: 'MES' }, { value: '储罐', label: '储罐' }]} />
          ) : null}
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">{title}</div>
        <div className="table-actions">
          {!isReadOnlyImmediate ? (
            <>
              <SelectedCountText selectedCount={selectedRowKeys.length} />
              <Button type="primary" onClick={openCreate}>新增</Button>
              <Popconfirm title="确定删除选中的库存记录吗？" onConfirm={handleBatchDelete}>
                <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
              </Popconfirm>
            </>
          ) : null}
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={pagedRows}
          pagination={false}
          rowSelection={isReadOnlyImmediate ? undefined : { selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: kind === '即时库存' ? 1500 : 1200 }}
          columns={[
            { title: '物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) },
            { title: '类型', dataIndex: 'materialType', width: 120 },
            ...(kind !== '即时库存' ? [
              { title: '计划日期', dataIndex: 'plannedDate', width: 120, render: (v: string) => v ?? '-' },
            ] : []),
            ...(kind !== '即时库存' ? [
              { title: '批号', dataIndex: 'batchNo', width: 160, render: (v: string) => v || '-' },
            ] : []),
            { title: kind === '即时库存' ? '物料账面库存' : '数量', dataIndex: 'quantity', width: 130 },
            ...(kind === '即时库存' ? [
              {
                title: '物料当前占用',
                dataIndex: 'materialCode',
                width: 130,
                render: (materialCode: string) => getMaterialInventorySummary(store, materialCode, location).reservedQuantity,
              },
              {
                title: '物料可用量',
                dataIndex: 'materialCode',
                width: 130,
                render: (materialCode: string) => getMaterialInventorySummary(store, materialCode, location).availableQuantity,
              },
            ] : []),
            { title: '单位', dataIndex: 'unit', width: 100 },
            { title: '来源', dataIndex: 'source', width: 100, render: (v: string, row: InventoryTableRow) => <Tag>{row.sourceLabel ?? v}</Tag> },
            { title: '更新时间', dataIndex: 'updatedAt', width: 220 },
            ...(!isReadOnlyImmediate ? [{
              title: '操作',
              width: 140,
              fixed: 'right' as const,
              render: (_: unknown, row: InventoryTableRow) => (
                <Space>
                  <Button type="link" onClick={() => openEdit(row)}>编辑</Button>
                  <Popconfirm title="确定删除这条记录吗？" onConfirm={() => store.deleteInventoryAction(row.id)}>
                    <Button type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            }] : []),
          ]}
        />
        <ListPageFooter
          note={isBarcodeSourcedImmediate ? '物料账面库存来源于条码档案中库存状态为“库内”的条码剩余数量汇总，不支持在即时库存手动新增。'
            : isLineSideSourcedImmediate ? '线边仓即时库存来源于库存状态为“库外”的条码剩余数量和储罐档案当前数量汇总，不支持手动新增。'
            : kind === '即时库存' ? `${location}物料当前占用为生产订单对${location}即时库存的当前占用汇总；物料可用量 = 物料账面库存 - 物料当前占用。` : undefined}
          current={effectivePage}
          pageSize={pageSize}
          total={rows.length}
          onChange={setPage}
        />
      </Card>

      <Modal
        title={editingId ? `编辑${title}` : `新增${title}`}
        open={open}
        onCancel={() => { setOpen(false); setEditingId(null); form.resetFields(); }}
        onOk={submit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={900}
      >
        <Form form={form} layout="vertical">
          <Space wrap style={{ width: '100%' }}>
            <Form.Item label="记录编号" name="id" rules={[{ required: true, message: '请输入记录编号' }]} style={{ width: 220 }}>
              <Input disabled={Boolean(editingId)} />
            </Form.Item>
            <Form.Item label="物料" name="materialCode" rules={[{ required: true, message: '请选择物料' }]} style={{ width: 220 }}>
              <Select options={store.materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
            </Form.Item>
            <Form.Item label="物料类型" name="materialType" rules={[{ required: true, message: '请选择类型' }]} style={{ width: 220 }}>
              <Select options={[{ value: '原料', label: '原料' }, { value: '中间物料', label: '中间物料' }, { value: '基准料', label: '基准料' }, { value: '主产品', label: '主产品' }, { value: '成品', label: '成品' }]} />
            </Form.Item>
            {kind !== '即时库存' ? (
              <Form.Item label="计划日期" name="plannedDate" style={{ width: 220 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            ) : null}
            {kind !== '即时库存' ? (
              <Form.Item label="批号" name="batchNo" style={{ width: 220 }}>
                <Input />
              </Form.Item>
            ) : null}
            <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]} style={{ width: 220 }}>
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]} style={{ width: 220 }}>
              <Input />
            </Form.Item>
            <Form.Item label="来源" name="source" style={{ width: 220 }}>
              <Select options={[{ value: '手动', label: '手动' }, { value: 'ERP', label: 'ERP' }, { value: 'MES', label: 'MES' }, { value: '储罐', label: '储罐' }]} />
            </Form.Item>
            <Form.Item label="更新时间" name="updatedAt" style={{ width: 220 }}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
