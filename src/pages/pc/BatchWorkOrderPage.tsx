import { Button, Card, Space, Table } from 'antd';
import { useEffect, useMemo } from 'react';
import { TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { BatchWorkOrder } from '../../domain/models/mes';
import { useMesStore } from '../../store/useMesStore';
import { lineName, materialName } from '../../utils/display';

type BatchWorkOrderTreeRow = BatchWorkOrder & {
  children?: BatchWorkOrderTreeRow[];
};

export function BatchWorkOrderPage() {
  const store = useMesStore();
  const pruneInvalidChildBatchWorkOrders = store.pruneInvalidChildBatchWorkOrdersAction;
  useEffect(() => {
    pruneInvalidChildBatchWorkOrders();
  }, [pruneInvalidChildBatchWorkOrders]);

  const treeRows = useMemo(() => {
    const childrenByParentId = store.batchWorkOrders.reduce<Record<string, BatchWorkOrderTreeRow[]>>((acc, workOrder) => {
      if (!workOrder.parentBatchWorkOrderId) return acc;
      acc[workOrder.parentBatchWorkOrderId] = [...(acc[workOrder.parentBatchWorkOrderId] ?? []), { ...workOrder }];
      return acc;
    }, {});

    const attachChildren = (workOrder: BatchWorkOrder): BatchWorkOrderTreeRow => {
      const children = childrenByParentId[workOrder.id]
        ?.sort((a, b) => a.id.localeCompare(b.id))
        .map(attachChildren);
      return {
        ...workOrder,
        children,
      };
    };

    const topLevelRows = store.batchWorkOrders.filter((workOrder) => !workOrder.parentBatchWorkOrderId || !store.batchWorkOrders.some((item) => item.id === workOrder.parentBatchWorkOrderId));
    return topLevelRows.map(attachChildren);
  }, [store.batchWorkOrders]);

  const scheduleByProductionOrderId = useMemo(
    () => new Map(store.scheduleItems.map((item) => [item.productionOrderId, item])),
    [store.scheduleItems],
  );

  return (
    <div className="page">
      <div className="page-title">
        <h2>批次工单</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">批次工单</div>
        <div className="table-actions">
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={treeRows}
          pagination={false}
          expandable={{ defaultExpandAllRows: true }}
          tableLayout="fixed"
          scroll={{ x: 1900 }}
          columns={[
            {
              title: '批次工单',
              dataIndex: 'id',
              width: 420,
              ellipsis: true,
              render: (value) => <span title={value}>{value}</span>,
            },
            { title: '批号', dataIndex: 'batchNo', width: 220, render: (v) => v ?? '-' },
            {
              title: '关联排程单',
              dataIndex: 'productionOrderId',
              width: 170,
              render: (productionOrderId) => scheduleByProductionOrderId.get(productionOrderId)?.id ?? '-',
            },
            {
              title: '关联生产订单',
              dataIndex: 'productionOrderId',
              width: 170,
              render: (v) => v ?? '-',
            },
            { title: '类型', dataIndex: 'type', width: 100 },
            { title: '阶段', dataIndex: 'stage', width: 100 },
            { title: '生产物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) },
            { title: '生产工艺', dataIndex: 'productionCraftCode', width: 220, render: (v) => store.productionCrafts.find((craft) => craft.code === v)?.name ?? v ?? '-' },
            { title: '计划数量', dataIndex: 'plannedQuantity', width: 120 },
            { title: '产线', dataIndex: 'lineCode', width: 180, render: (v) => lineName(store, v) },
            { title: '关联主工单', dataIndex: 'parentBatchWorkOrderId', width: 180, render: (v) => v ?? '-' },
            { title: '状态', dataIndex: 'status', width: 120, render: (v) => <StatusTag value={v} /> },
            {
              title: '操作',
              width: 180,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  {row.status === '待执行' && <Button type="link" onClick={() => store.startBatchWorkOrderAction(row.id)}>开工</Button>}
                  {row.status === '执行中' && <Button type="link" onClick={() => store.pauseBatchWorkOrderAction(row.id)}>暂停</Button>}
                  {(row.status === '执行中' || row.status === '暂停中') && <Button type="link" danger onClick={() => store.completeBatchWorkOrderAction(row.id)}>完工</Button>}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
