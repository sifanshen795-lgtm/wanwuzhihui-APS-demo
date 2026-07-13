import { Button, Card, DatePicker, Empty, Input, message, Popconfirm, Select, Space, Table } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { Key } from 'react';
import { useMemo, useState } from 'react';
import { SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { ScheduleItemStatus } from '../../domain/enums';
import type { BatchWorkOrder } from '../../domain/models/mes';
import { getSchedulePushdownDetail } from '../../domain/services/scheduleService';
import { useMesStore } from '../../store/useMesStore';
import { lineName, materialName } from '../../utils/display';

const { RangePicker } = DatePicker;
const getDefaultScheduleRange = (): [Dayjs, Dayjs] => [dayjs().startOf('day'), dayjs().add(7, 'day').endOf('day')];

type BatchWorkOrderTreeRow = BatchWorkOrder & {
  children?: BatchWorkOrderTreeRow[];
};

const buildBatchWorkOrderTree = (workOrders: BatchWorkOrder[]): BatchWorkOrderTreeRow[] => {
  const childrenByParentId = workOrders.reduce<Record<string, BatchWorkOrderTreeRow[]>>((acc, workOrder) => {
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

  return workOrders
    .filter((workOrder) => !workOrder.parentBatchWorkOrderId || !workOrders.some((item) => item.id === workOrder.parentBatchWorkOrderId))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(attachChildren);
};

export function ScheduleOutputPage() {
  const store = useMesStore();
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [lineFilter, setLineFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<'全部' | ScheduleItemStatus>('全部');
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(() => getDefaultScheduleRange());
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    lineFilter: undefined as string | undefined,
    statusFilter: '全部' as '全部' | ScheduleItemStatus,
    timeRange: getDefaultScheduleRange() as [Dayjs | null, Dayjs | null] | null,
  });

  const filteredScheduleItems = useMemo(() => store.scheduleItems.filter((item) => {
    if (appliedFilters.statusFilter !== '全部' && item.status !== appliedFilters.statusFilter) return false;
    if (appliedFilters.lineFilter && item.lineCode !== appliedFilters.lineFilter) return false;
    if (appliedFilters.keyword.trim()) {
      const keywordText = appliedFilters.keyword.trim().toLowerCase();
      const material = store.materials.find((entry) => entry.code === item.productCode);
      if (!`${item.id} ${item.productionOrderId} ${item.productCode} ${material?.name ?? ''}`.toLowerCase().includes(keywordText)) return false;
    }
    const [from, to] = appliedFilters.timeRange ?? [];
    if (from || to) {
      const itemStart = dayjs(item.startAt);
      const itemEnd = dayjs(item.endAt);
      const rangeStart = from?.startOf('minute');
      const rangeEnd = to?.endOf('minute');
      if (rangeStart && itemEnd.isBefore(rangeStart)) return false;
      if (rangeEnd && itemStart.isAfter(rangeEnd)) return false;
    }
    return true;
  }), [appliedFilters, store.materials, store.scheduleItems]);

  const selectedPushableIds = selectedRowKeys
    .map(String)
    .filter((id) => store.scheduleItems.find((item) => item.id === id)?.status === '待下推');

  const handleSearch = () => {
    setAppliedFilters({ keyword, lineFilter, statusFilter, timeRange });
    setSelectedRowKeys([]);
  };

  const handleReset = () => {
    const defaultRange = getDefaultScheduleRange();
    setKeyword('');
    setLineFilter(undefined);
    setStatusFilter('全部');
    setTimeRange(defaultRange);
    setAppliedFilters({ keyword: '', lineFilter: undefined, statusFilter: '全部', timeRange: defaultRange });
    setSelectedRowKeys([]);
  };

  const handlePushDown = (scheduleItemIds: string[]) => {
    try {
      store.pushDownSchedule(scheduleItemIds);
      message.success('已下推排程单，生成批次工单和配方单');
      setSelectedRowKeys((keys) => keys.filter((key) => !scheduleItemIds.includes(String(key))));
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleRecallPushdown = (scheduleItemId: string) => {
    try {
      store.recallSchedulePushdown([scheduleItemId]);
      message.success('已撤回排程单下推，状态恢复为待下推');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>排程输出</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="排程单 / MO / 物料编码 / 名称" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 300 }} />
          <Select allowClear placeholder="产线" value={lineFilter} onChange={setLineFilter} style={{ width: 220 }} options={store.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as '全部' | ScheduleItemStatus)}
            style={{ width: 160 }}
            options={[
              { value: '全部', label: '全部状态' },
              { value: '待下推', label: '待下推' },
              { value: '待执行', label: '待执行' },
              { value: '执行中', label: '执行中' },
              { value: '已完成', label: '已完成' },
            ]}
          />
          <RangePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" value={timeRange} onChange={setTimeRange} placeholder={['计划开始/结束起', '计划开始/结束止']} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">排程输出列表</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" disabled={!selectedPushableIds.length} onClick={() => handlePushDown(selectedPushableIds)}>排程单下推</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={filteredScheduleItems}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1500 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            getCheckboxProps: (record) => ({ disabled: record.status !== '待下推' }),
          }}
          locale={{ emptyText: <Empty description="暂无符合条件的排程单" /> }}
          expandable={{
            rowExpandable: (record) => {
              const detail = getSchedulePushdownDetail(store, record.id);
              return Boolean(detail?.workOrders.length);
            },
            expandedRowRender: (record) => {
              const detail = getSchedulePushdownDetail(store, record.id);
              const workOrderTreeRows = buildBatchWorkOrderTree(detail?.workOrders ?? []);
              return (
                <Table
                  className="schedule-output-child-table"
                  rowKey="id"
                  dataSource={workOrderTreeRows}
                  pagination={false}
                  size="small"
                  expandable={{ defaultExpandAllRows: true }}
                  columns={[
                    { title: '批次工单号', dataIndex: 'id', width: 260 },
                    { title: '批次号', dataIndex: 'batchNo', width: 170 },
                    { title: '类型', dataIndex: 'type', width: 100 },
                    { title: '物料', dataIndex: 'materialCode', width: 180, render: (v) => materialName(store, v) },
                    { title: '产线', dataIndex: 'lineCode', width: 180, render: (v) => lineName(store, v) },
                    { title: '计划数量', dataIndex: 'plannedQuantity', width: 120, render: (v, row) => `${v} ${row.unit}` },
                    { title: '计划开始', dataIndex: 'plannedStartAt', width: 170, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                    { title: '计划结束', dataIndex: 'plannedEndAt', width: 170, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
                    { title: '状态', dataIndex: 'status', width: 110, render: (v) => <StatusTag value={v} /> },
                  ]}
                />
              );
            },
          }}
          columns={[
            { title: '排程单号', dataIndex: 'id', width: 150 },
            { title: 'MO 单号', dataIndex: 'productionOrderId', width: 140 },
            { title: '主产品', dataIndex: 'productCode', width: 180, render: (v) => materialName(store, v) },
            { title: '产线', dataIndex: 'lineCode', width: 180, render: (v) => lineName(store, v) },
            { title: '计划开始', dataIndex: 'startAt', width: 170, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
            { title: '计划结束', dataIndex: 'endAt', width: 170, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
            { title: '批次数', dataIndex: 'batchCount', width: 100 },
            { title: '计划工时', dataIndex: 'workHours', width: 120, render: (v) => `${v} h` },
            { title: '状态', dataIndex: 'status', width: 110, render: (v) => <StatusTag value={v} /> },
            {
              title: '操作',
              width: 180,
              fixed: 'right',
              render: (_, record) => {
                const detail = getSchedulePushdownDetail(store, record.id);
                return (
                  <Space>
                    {record.status === '待下推' ? <Button type="link" size="small" onClick={() => handlePushDown([record.id])}>下推</Button> : null}
                    {record.status === '待执行' && detail?.canRecall ? (
                      <Popconfirm title="确认撤回排程单下推？将删除关联批次工单和配方单" onConfirm={() => handleRecallPushdown(record.id)}>
                        <Button type="link" size="small">撤回下推</Button>
                      </Popconfirm>
                    ) : null}
                    {record.status !== '待下推' && detail?.recallBlockReason && !detail.canRecall ? <span style={{ color: 'var(--color-text-secondary)' }}>{detail.recallBlockReason}</span> : null}
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
