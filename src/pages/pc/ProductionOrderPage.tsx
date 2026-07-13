import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ListPageFooter, SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { ProductionOrder } from '../../domain/models/mes';
import { formatOverdueText, getDeliveryRiskMinutes } from '../../domain/services/autoScheduleService';
import { calculateProductionOrderFulfillmentDate, getCurrentReservedQuantity, getPickedQuantity, getReservationLocation, getReservationsForProductionOrder, getReturnedQuantity, previewReplenishProductionOrderKit } from '../../domain/services/inventoryReservationService';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';
import { formatProductionOrderKitText, productionOrderKitStatusColor } from '../../utils/kitDisplay';

const replenishableStatus = ['未排程', '已排程'];

const formatFulfillmentDate = (value?: string) => {
  if (!value) return '预计缺料';
  if (value === '当前') return '当前可齐套';
  return `预计 ${value}`;
};

export function ProductionOrderPage() {
  const store = useMesStore();
  const [barcodeForm] = Form.useForm<{ barcodeCode: string }>();
  const [barcodeOperation, setBarcodeOperation] = useState<{ type: 'pick' | 'return'; order: ProductionOrder } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', statusFilter: undefined as string | undefined });
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => store.productionOrders
    .filter((order) => !appliedFilters.keyword || `${order.id} ${order.productCode} ${order.salesOrderIds.join(' ')}`.includes(appliedFilters.keyword))
    .filter((order) => !appliedFilters.statusFilter || order.status === appliedFilters.statusFilter), [appliedFilters, store.productionOrders]);
  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(filteredOrders.length / pageSize)));
  const pagedOrders = useMemo(
    () => filteredOrders.slice((effectivePage - 1) * pageSize, effectivePage * pageSize),
    [effectivePage, filteredOrders],
  );

  useEffect(() => {
    setPage(1);
  }, [appliedFilters.keyword, appliedFilters.statusFilter]);

  const handleDeleteOrder = (productionOrderId: string) => {
    try {
      store.deleteProductionOrderAction(productionOrderId);
      setSelectedRowKeys((keys) => keys.filter((key) => key !== productionOrderId));
      message.success('已删除生产订单，并回退销售订单下推数量');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleBatchDeleteOrders = () => {
    const deletableIds = selectedRowKeys
      .map(String)
      .filter((id) => store.productionOrders.find((item) => item.id === id)?.status === '未排程');
    if (!deletableIds.length) {
      message.warning('请选择未排程的生产订单');
      return;
    }
    deletableIds.forEach((id) => store.deleteProductionOrderAction(id));
    setSelectedRowKeys((keys) => keys.filter((key) => !deletableIds.includes(String(key))));
    message.success('已批量删除生产订单，并回退销售订单下推数量');
  };

  const showScheduleResultMessage = (orderIds: string[]) => {
    const overdueOrders = orderIds
      .map((id) => store.productionOrders.find((item) => item.id === id))
      .filter((order): order is ProductionOrder => Boolean(order))
      .filter((order) => getDeliveryRiskMinutes(order) > 0);
    if (!overdueOrders.length) return;
    const worstMinutes = Math.max(...overdueOrders.map((order) => getDeliveryRiskMinutes(order)));
    message.warning(`其中 ${overdueOrders.length} 张订单超交期，最严重 ${formatOverdueText(worstMinutes)}`);
  };

  const handlePushSchedule = (productionOrderId: string) => {
    try {
      store.pushProductionOrderToScheduleAction(productionOrderId);
      message.success('已生成排程方案，可在计划排程页调整');
      showScheduleResultMessage([productionOrderId]);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleBatchPushSchedule = () => {
    const pushableIds = selectedRowKeys
      .map(String)
      .filter((id) => store.productionOrders.find((item) => item.id === id)?.status === '未排程');
    if (!pushableIds.length) {
      message.warning('请选择未排程的生产订单');
      return;
    }
    try {
      store.pushProductionOrdersToScheduleAction(pushableIds);
      setSelectedRowKeys((keys) => keys.filter((key) => !pushableIds.includes(String(key))));
      message.success(`已为 ${pushableIds.length} 张生产订单生成排程方案`);
      showScheduleResultMessage(pushableIds);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleRecallSchedule = (productionOrderId: string) => {
    try {
      store.recallProductionOrderScheduleAction(productionOrderId);
      message.success('已撤回排程');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const canReplenish = (order: ProductionOrder) =>
    replenishableStatus.includes(order.status)
    && (order.kitReadyQuantity ?? 0) < order.quantity;

  const handleReplenish = (productionOrderIds: string[]) => {
    try {
      store.replenishProductionOrderKitAction(productionOrderIds);
      message.success('已补齐库存占用');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const openBarcodeOperation = (type: 'pick' | 'return', order: ProductionOrder) => {
    setBarcodeOperation({ type, order });
    barcodeForm.resetFields();
  };

  const handleBarcodeSubmit = async () => {
    if (!barcodeOperation) return;
    const values = await barcodeForm.validateFields();
    try {
      if (barcodeOperation.type === 'pick') {
        store.pickProductionOrderByBarcodeAction(barcodeOperation.order.id, values.barcodeCode);
        message.success('领料成功，条码已移至库外');
      } else {
        store.returnProductionOrderByBarcodeAction(barcodeOperation.order.id, values.barcodeCode);
        message.success('退料成功，条码已移回库内');
      }
      setBarcodeOperation(null);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const selectedReplenishableIds = selectedRowKeys
    .map(String)
    .filter((id) => {
      const order = store.productionOrders.find((item) => item.id === id);
      return order ? canReplenish(order) : false;
    });
  const selectedPushableIds = selectedRowKeys
    .map(String)
    .filter((id) => store.productionOrders.find((item) => item.id === id)?.status === '未排程');

  const handleSearch = () => setAppliedFilters({ keyword, statusFilter });

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setAppliedFilters({ keyword: '', statusFilter: undefined });
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>生产订单</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="MO 单号 / 主产品 / 销售订单" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 320 }} />
          <Select allowClear placeholder="状态" value={statusFilter} onChange={setStatusFilter} style={{ width: 180 }} options={[{ value: '未排程', label: '未排程' }, { value: '已排程', label: '已排程' }]} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">生产订单</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" disabled={!selectedPushableIds.length} onClick={handleBatchPushSchedule}>批量下推排程</Button>
          <Button disabled={!selectedReplenishableIds.length} onClick={() => handleReplenish(selectedReplenishableIds)}>批量补齐库存占用</Button>
          <Popconfirm title="确定删除选中的生产订单并撤回下推吗？" onConfirm={handleBatchDeleteOrders}>
            <Button danger disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={pagedOrders}
          pagination={false}
          scroll={{ x: 1800 }}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          expandable={{
            expandedRowRender: (row) => {
              const reservations = getReservationsForProductionOrder(store, row.id);
              const preview = canReplenish(row)
                ? (() => {
                  try {
                    return previewReplenishProductionOrderKit(store, row.id);
                  } catch {
                    return null;
                  }
                })()
                : null;
              return (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ fontWeight: 600 }}>销售订单分配明细</div>
                  <Space wrap>{row.salesOrderAllocations.map((item) => <Tag key={item.salesOrderId}>{item.salesOrderId} × {item.quantity}</Tag>)}</Space>
                  <div style={{ fontWeight: 600 }}>库存占用明细</div>
                  <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={reservations}
                    columns={[
                      { title: '物料', dataIndex: 'materialCode', width: 200, render: (v) => materialName(store, v) },
                      { title: '库存位置', width: 100, render: (_, item) => getReservationLocation(item) },
                      { title: '需求数量', dataIndex: 'requiredQuantity', width: 120 },
                      { title: '初始占用数量', dataIndex: 'reservedQuantity', width: 130 },
                      { title: '已领料数量', dataIndex: 'pickedQuantity', width: 120, render: (_, item) => getPickedQuantity(item) },
                      { title: '已退料数量', dataIndex: 'returnedQuantity', width: 120, render: (_, item) => getReturnedQuantity(item) },
                      { title: '当前占用数量', width: 130, render: (_, item) => getCurrentReservedQuantity(item) },
                      { title: '缺口', dataIndex: 'shortageQuantity', width: 120 },
                    ]}
                  />
                  {preview && preview.additionalKitReady > 0 ? (
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      当前可再补齐 {preview.additionalKitReady}，库存齐套后将变为 {formatProductionOrderKitText(preview.nextKitReadyStatus, preview.nextKitReadyQuantity, row.quantity)}
                    </span>
                  ) : null}
                </Space>
              );
            },
          }}
          columns={[
            { title: 'MO 单号', dataIndex: 'id', width: 140 },
            { title: '生产批号', dataIndex: 'batchNo', width: 180, render: (v) => v ?? '-' },
            { title: '主产品', dataIndex: 'productCode', width: 180, render: (v) => materialName(store, v) },
            { title: '数量', dataIndex: 'quantity', width: 100 },
            { title: '关联销售订单', dataIndex: 'salesOrderIds', width: 200, render: (v) => v.join(', ') },
            { title: '交期', dataIndex: 'deliveryDate', width: 120 },
            {
              title: '库存齐套',
              dataIndex: 'kitReadyStatus',
              width: 190,
              render: (_, row) => {
                const kitReadyQuantity = row.kitReadyQuantity ?? 0;
                return <Tag color={productionOrderKitStatusColor(row.kitReadyStatus)}>{formatProductionOrderKitText(row.kitReadyStatus, kitReadyQuantity, row.quantity)}</Tag>;
              },
            },
            {
              title: '预计齐套日期',
              width: 150,
              render: (_, row) => formatFulfillmentDate(calculateProductionOrderFulfillmentDate(store, row)),
            },
            { title: '状态', dataIndex: 'status', width: 110, render: (v) => <StatusTag value={v} /> },
            {
              title: '操作',
              width: 280,
              fixed: 'right',
              render: (_, row) => {
                const replenishPreview = canReplenish(row)
                  ? (() => {
                    try {
                      return previewReplenishProductionOrderKit(store, row.id);
                    } catch {
                      return null;
                    }
                  })()
                  : null;
                return (
                  <Space>
                    <Button type="link" onClick={() => openBarcodeOperation('pick', row)}>领料</Button>
                    <Button type="link" onClick={() => openBarcodeOperation('return', row)}>退料</Button>
                    {row.status === '未排程' ? (
                      <Button type="link" onClick={() => handlePushSchedule(row.id)}>下推排程</Button>
                    ) : null}
                    {row.status === '已排程' ? (
                      <Popconfirm title="确认撤回排程？将删除关联排程单" onConfirm={() => handleRecallSchedule(row.id)}>
                        <Button type="link">撤回排程</Button>
                      </Popconfirm>
                    ) : null}
                    {replenishPreview && replenishPreview.additionalKitReady > 0 ? (
                      <Popconfirm
                        title={`确认补齐库存占用？本次可新增 ${replenishPreview.additionalKitReady}，达到 ${formatProductionOrderKitText(replenishPreview.nextKitReadyStatus, replenishPreview.nextKitReadyQuantity, row.quantity)}`}
                        onConfirm={() => handleReplenish([row.id])}
                      >
                        <Button type="link">补齐库存占用</Button>
                      </Popconfirm>
                    ) : null}
                    <Popconfirm title="确定删除该生产订单并撤回下推吗？" onConfirm={() => handleDeleteOrder(row.id)}>
                      <Button type="link" danger disabled={row.status !== '未排程'}>删除</Button>
                    </Popconfirm>
                  </Space>
                );
              },
            },
          ]}
        />
        <Modal
          title={barcodeOperation?.type === 'pick' ? '生产订单领料' : '生产订单退料'}
          open={Boolean(barcodeOperation)}
          onCancel={() => setBarcodeOperation(null)}
          onOk={handleBarcodeSubmit}
          okText="提交"
          cancelText="取消"
          destroyOnClose
        >
          <Form form={barcodeForm} layout="vertical">
            <Form.Item label="生产订单">
              <Input value={barcodeOperation?.order.id} disabled />
            </Form.Item>
            <Form.Item
              label="条码"
              name="barcodeCode"
              rules={[{ required: true, message: '请输入条码' }]}
            >
              <Input placeholder={barcodeOperation?.type === 'pick' ? '请输入库内条码' : '请输入库外条码'} autoFocus />
            </Form.Item>
          </Form>
        </Modal>
        <ListPageFooter
          note="库存齐套按即时库存和当前占用数量计算，不含预计入库；预计齐套日期按即时库存 + 预计入库评估。"
          current={effectivePage}
          pageSize={pageSize}
          total={filteredOrders.length}
          onChange={setPage}
        />
      </Card>
    </div>
  );
}
