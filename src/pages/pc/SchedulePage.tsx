import { Alert, Button, Card, DatePicker, Empty, Input, message, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { Key } from 'react';
import { useMemo, useRef, useState } from 'react';
import { SimpleGantt, type GanttDisplayStatus, type GanttItem } from '../../components/SimpleGantt';
import { SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { ProductionOrderScheduleEditModal } from '../../components/ProductionOrderScheduleEditModal';
import { StatusTag } from '../../components/StatusTag';
import type { ProductionOrderStatus } from '../../domain/enums';
import type { ProductionOrder, ScheduleItem, ScheduleRule } from '../../domain/models/mes';
import { formatOverdueText, getDeliveryRiskMinutes } from '../../domain/services/autoScheduleService';
import { getSchedulePushdownDetail } from '../../domain/services/scheduleService';
import { useMesStore } from '../../store/useMesStore';
import { lineName, materialName } from '../../utils/display';

const { RangePicker } = DatePicker;
const DEFAULT_GANTT_HOUR_WIDTH = 1;
const getDefaultScheduleRange = (): [Dayjs, Dayjs] => [dayjs().startOf('month'), dayjs().endOf('month')];
const hasSchedulePlan = (order: ProductionOrder) => Boolean(order.lineCode && order.plannedStartAt && order.plannedEndAt && order.batchCount);

export function SchedulePage() {
  const store = useMesStore();
  const [ruleOpen, setRuleOpen] = useState(false);
  const [dragRuleCode, setDragRuleCode] = useState<string | null>(null);
  const [selectedProductionOrderKeys, setSelectedProductionOrderKeys] = useState<Key[]>([]);
  const [editingProductionOrderId, setEditingProductionOrderId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(() => getDefaultScheduleRange());
  const [lineFilter, setLineFilter] = useState<string>();
  const [materialKeyword, setMaterialKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | ProductionOrderStatus>('全部');
  const [outputFilter, setOutputFilter] = useState<'全部' | '未输出' | '已输出'>('全部');
  const [appliedFilters, setAppliedFilters] = useState({
    materialKeyword: '',
    lineFilter: undefined as string | undefined,
    statusFilter: '全部' as '全部' | ProductionOrderStatus,
    outputFilter: '全部' as '全部' | '未输出' | '已输出',
    timeRange: getDefaultScheduleRange() as [Dayjs | null, Dayjs | null] | null,
  });
  const [ganttHourWidth, setGanttHourWidth] = useState(DEFAULT_GANTT_HOUR_WIDTH);
  const [highlightProductionOrderId, setHighlightProductionOrderId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const scheduleRules = [...(store.scheduleRules ?? [])].sort((a, b) => a.priority - b.priority);
  const scheduleByProductionOrderId = useMemo(() => new Map(store.scheduleItems.map((item) => [item.productionOrderId, item])), [store.scheduleItems]);
  const filteredProductionOrders = useMemo(() => store.productionOrders.filter((order) => {
    const output = scheduleByProductionOrderId.get(order.id);
    if (appliedFilters.statusFilter !== '全部' && order.status !== appliedFilters.statusFilter) return false;
    if (appliedFilters.outputFilter === '未输出' && output) return false;
    if (appliedFilters.outputFilter === '已输出' && !output) return false;
    if (appliedFilters.lineFilter && order.lineCode !== appliedFilters.lineFilter) return false;
    if (appliedFilters.materialKeyword.trim()) {
      const keyword = appliedFilters.materialKeyword.trim().toLowerCase();
      const material = store.materials.find((entry) => entry.code === order.productCode);
      if (!`${order.productCode} ${material?.name ?? ''} ${order.id}`.toLowerCase().includes(keyword)) return false;
    }
    const [from, to] = appliedFilters.timeRange ?? [];
    if ((from || to) && hasSchedulePlan(order)) {
      const itemStart = dayjs(order.plannedStartAt);
      const itemEnd = dayjs(order.plannedEndAt);
      const rangeStart = from?.startOf('minute');
      const rangeEnd = to?.endOf('minute');
      if (rangeStart && itemEnd.isBefore(rangeStart)) return false;
      if (rangeEnd && itemStart.isAfter(rangeEnd)) return false;
    }
    return true;
  }), [appliedFilters, scheduleByProductionOrderId, store.materials, store.productionOrders]);

  const ganttItems = useMemo(() => filteredProductionOrders
    .filter(hasSchedulePlan)
    .map((order): GanttItem => {
      const output = scheduleByProductionOrderId.get(order.id);
      const ganttStatus: GanttDisplayStatus = !output
        ? '已排程'
        : output.status === '待下推'
          ? '已下推排程单'
          : output.status === '待执行'
            ? '排程单待执行'
            : output.status === '执行中'
              ? '排程单执行中'
              : '排程单已完成';
      return {
        id: `PLAN-${order.id}`,
        productionOrderId: order.id,
        productCode: order.productCode,
        lineCode: order.lineCode!,
        startAt: order.plannedStartAt!,
        endAt: order.plannedEndAt!,
        batchCount: order.batchCount!,
        workHours: order.workHours ?? 0,
        cleanMinutes: order.cleanMinutes ?? 0,
        singlePotOutput: order.singlePotOutput ?? 1,
        singlePotWorkHours: order.singlePotWorkHours ?? 0,
        status: output?.status ?? '待下推',
        ganttStatus,
        deliveryDate: order.deliveryDate,
        productionOrderStatus: order.status,
        scheduleReason: order.scheduleReason,
      };
    }), [filteredProductionOrders, scheduleByProductionOrderId]);

  const selectedOrders = useMemo(
    () => selectedProductionOrderKeys
      .map(String)
      .map((id) => store.productionOrders.find((item) => item.id === id))
      .filter((order): order is ProductionOrder => Boolean(order)),
    [selectedProductionOrderKeys, store.productionOrders],
  );
  const selectedOverdueCount = useMemo(
    () => selectedOrders.filter((order) => getDeliveryRiskMinutes(order) > 0).length,
    [selectedOrders],
  );

  const outputSchedule = () => {
    store.outputProductionOrdersToScheduleAction(selectedProductionOrderKeys.map(String));
    message.success('已输出选中的生产订单为排程单');
    setSelectedProductionOrderKeys([]);
  };

  const handleOutputSchedule = () => {
    if (!selectedProductionOrderKeys.length) return;
    if (selectedOverdueCount > 0) {
      Modal.confirm({
        title: '存在超交期排程',
        content: `选中的 ${selectedProductionOrderKeys.length} 张生产订单中，有 ${selectedOverdueCount} 张计划结束时间超过交货日期，确认继续输出排程单？`,
        okText: '继续输出',
        cancelText: '取消',
        onOk: () => {
          try {
            outputSchedule();
          } catch (e) {
            message.error((e as Error).message);
          }
        },
      });
      return;
    }
    try {
      outputSchedule();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const recallOutput = (scheduleItemId: string) => {
    try {
      store.recallScheduleOutputAction([scheduleItemId]);
      message.success('已撤回排程单');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleGanttItemChange = (item: ScheduleItem, payload: { lineCode: string; startAt: string; endAt: string }) => {
    try {
      store.updateProductionOrderScheduleWindowAction(item.productionOrderId, payload);
      message.success('已更新排程时间');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const resetFilters = () => {
    const defaultRange = getDefaultScheduleRange();
    setTimeRange(defaultRange);
    setLineFilter(undefined);
    setMaterialKeyword('');
    setStatusFilter('全部');
    setOutputFilter('全部');
    setAppliedFilters({ materialKeyword: '', lineFilter: undefined, statusFilter: '全部', outputFilter: '全部', timeRange: defaultRange });
    setGanttHourWidth(DEFAULT_GANTT_HOUR_WIDTH);
    setSelectedProductionOrderKeys([]);
  };

  const handleSearch = () => {
    setAppliedFilters({ materialKeyword, lineFilter, statusFilter, outputFilter, timeRange });
    setSelectedProductionOrderKeys([]);
  };

  const locateProductionOrderRow = (productionOrderId: string) => {
    document.getElementById(`schedule-order-row-${productionOrderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightProductionOrderId(productionOrderId);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightProductionOrderId(null), 1200);
  };

  const persistRuleOrder = (rules: ScheduleRule[]) => {
    store.updateScheduleRulesAction(rules.map((rule, index) => ({ ...rule, priority: index + 1 })));
  };

  const updateRule = (rule: ScheduleRule, patch: Partial<ScheduleRule>) => {
    persistRuleOrder(scheduleRules.map((item) => (item.code === rule.code ? { ...item, ...patch } : item)));
  };

  const moveRule = (fromCode: string, toCode: string) => {
    if (fromCode === toCode) return;
    const nextRules = [...scheduleRules];
    const fromIndex = nextRules.findIndex((item) => item.code === fromCode);
    const toIndex = nextRules.findIndex((item) => item.code === toCode);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = nextRules.splice(fromIndex, 1);
    nextRules.splice(toIndex, 0, moved);
    persistRuleOrder(nextRules);
  };

  const ruleTable = (
    <>
      <Table
        rowKey="code"
        dataSource={scheduleRules}
        pagination={false}
        scroll={{ x: 900 }}
        onRow={(record) => ({
          draggable: true,
          onDragStart: () => setDragRuleCode(record.code),
          onDragOver: (event) => event.preventDefault(),
          onDrop: () => {
            if (dragRuleCode) moveRule(dragRuleCode, record.code);
            setDragRuleCode(null);
          },
          onDragEnd: () => setDragRuleCode(null),
          style: { cursor: 'move', opacity: dragRuleCode === record.code ? 0.5 : 1 },
        })}
        columns={[
          { title: '排序', width: 90, render: (_, __, index) => <span style={{ cursor: 'move', color: 'var(--color-text-secondary)' }}>⋮⋮ {index + 1}</span> },
          { title: '规则名称', dataIndex: 'name', width: 220 },
          { title: '规则说明', dataIndex: 'remark', width: 360, render: (v) => v ?? '-' },
          { title: '启用', dataIndex: 'enabled', width: 100, render: (_, row) => <Switch checked={row.enabled} onChange={(checked) => updateRule(row, { enabled: checked })} /> },
          { title: '状态', dataIndex: 'enabled', width: 100, render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag> },
        ]}
      />
      <Space style={{ marginTop: 12 }}>
        <Button onClick={() => store.resetScheduleRulesAction()}>恢复默认规则</Button>
        <span style={{ color: 'var(--color-text-secondary)' }}>拖拽规则行调整顺序，越靠前优先级越高；启用规则会影响生产订单下推排程时的订单排序、产线选择与空窗填充。</span>
      </Space>
    </>
  );

  return (
    <div className="page">
      <div className="page-title">
        <h2>计划排程</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">排程操作</div>
        <div className="table-actions">
          <Button onClick={() => setRuleOpen(true)}>排程规则</Button>
        </div>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="物料编码 / 名称 / MO" value={materialKeyword} onChange={(event) => setMaterialKeyword(event.target.value)} style={{ width: 260 }} />
          <Select allowClear placeholder="产线" value={lineFilter} onChange={setLineFilter} style={{ width: 220 }} options={store.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as '全部' | ProductionOrderStatus)}
            style={{ width: 160 }}
            options={[
              { value: '全部', label: '全部状态' },
              { value: '未排程', label: '未排程' },
              { value: '已排程', label: '已排程' },
            ]}
          />
          <Select
            value={outputFilter}
            onChange={(value) => setOutputFilter(value as '全部' | '未输出' | '已输出')}
            style={{ width: 160 }}
            options={[
              { value: '全部', label: '全部输出状态' },
              { value: '未输出', label: '未输出' },
              { value: '已输出', label: '已输出' },
            ]}
          />
          <RangePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" value={timeRange} onChange={setTimeRange} placeholder={['计划开始/结束起', '计划开始/结束止']} />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={resetFilters}>重置</Button>
        </Space>
      </Card>

      <div className="schedule-workbench">
        <Card className="demo-card schedule-gantt-pane" title="甘特图" extra={<span style={{ color: 'var(--color-text-secondary)' }}>{ganttItems.length} 条 · 已输出排程单自动锁定</span>}>
          <SimpleGantt
            items={ganttItems}
            data={store}
            editable
            visibleStartAt={appliedFilters.timeRange?.[0]?.toISOString()}
            visibleEndAt={appliedFilters.timeRange?.[1]?.toISOString()}
            hourWidth={ganttHourWidth}
            onHourWidthChange={setGanttHourWidth}
            onItemClick={(item) => locateProductionOrderRow(item.productionOrderId)}
            onItemEdit={(item) => setEditingProductionOrderId(item.productionOrderId)}
            onItemWindowChange={handleGanttItemChange}
            canEditItem={(item) => !scheduleByProductionOrderId.has(item.productionOrderId)}
          />
        </Card>
        <Card
          className="demo-card schedule-detail-pane"
          title={`排程明细${store.scheduleItems.length ? `（已输出 ${store.scheduleItems.length} 条）` : ''}`}
          extra={(
            <Space>
              <SelectedCountText selectedCount={selectedProductionOrderKeys.length} />
              <Button type="primary" disabled={!selectedProductionOrderKeys.length} onClick={handleOutputSchedule}>排程下推</Button>
              <TableToolIcons />
            </Space>
          )}
        >
          <Table
            rowKey="id"
            dataSource={filteredProductionOrders}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 2200 }}
            rowSelection={{
              selectedRowKeys: selectedProductionOrderKeys,
              onChange: (keys) => setSelectedProductionOrderKeys(keys),
              getCheckboxProps: (record) => ({ disabled: record.status !== '已排程' || scheduleByProductionOrderId.has(record.id) }),
            }}
            onRow={(record) => ({ id: `schedule-order-row-${record.id}` })}
            rowClassName={(record) => (highlightProductionOrderId === record.id ? 'schedule-table-row-highlight' : '')}
            locale={{ emptyText: <Empty description="暂无符合条件的生产订单" /> }}
            columns={[
              { title: 'MO 单号', dataIndex: 'id', width: 140 },
              { title: '主产品', dataIndex: 'productCode', width: 180, render: (v) => materialName(store, v) },
              { title: '产线', dataIndex: 'lineCode', width: 180, render: (v) => (v ? lineName(store, v) : '-') },
              { title: '交货日期', dataIndex: 'deliveryDate', width: 120 },
              { title: '计划开始', dataIndex: 'plannedStartAt', width: 170, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
              { title: '计划结束', dataIndex: 'plannedEndAt', width: 170, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
              {
                title: '交期风险',
                width: 130,
                render: (_, record) => {
                  const overdueMinutes = getDeliveryRiskMinutes(record);
                  return overdueMinutes > 0 ? <Tag color="error">{formatOverdueText(overdueMinutes)}</Tag> : (record.plannedEndAt ? <Tag color="success">交期内</Tag> : '-');
                },
              },
              { title: '批次数', dataIndex: 'batchCount', width: 100, render: (v) => v ?? '-' },
              { title: '计划工时', dataIndex: 'workHours', width: 120, render: (v) => (v === undefined ? '-' : `${v} h`) },
              { title: '清机(min)', dataIndex: 'cleanMinutes', width: 110, render: (v) => v ?? '-' },
              { title: '订单状态', dataIndex: 'status', width: 110, render: (v) => <StatusTag value={v} /> },
              {
                title: '排程说明',
                width: 280,
                ellipsis: true,
                render: (_, record) => record.scheduleReason ?? '-',
              },
              {
                title: '排程单号',
                width: 150,
                render: (_, record) => scheduleByProductionOrderId.get(record.id)?.id ?? '-',
              },
              {
                title: '排程单状态',
                width: 130,
                render: (_, record) => {
                  const scheduleItem = scheduleByProductionOrderId.get(record.id);
                  return scheduleItem ? <StatusTag value={scheduleItem.status} /> : <Tag>未输出</Tag>;
                },
              },
              {
                title: '操作',
                width: 220,
                fixed: 'right',
                render: (_, record) => {
                  const scheduleItem = scheduleByProductionOrderId.get(record.id);
                  const detail = scheduleItem ? getSchedulePushdownDetail(store, scheduleItem.id) : null;
                  return (
                    <Space>
                      {record.status === '已排程' && !scheduleItem ? <Button type="link" size="small" onClick={() => setEditingProductionOrderId(record.id)}>编辑</Button> : null}
                      {scheduleItem?.status === '待下推' && detail?.canRecall ? (
                        <Popconfirm title="确认撤回？将删除该排程单" onConfirm={() => recallOutput(scheduleItem.id)}>
                          <Button type="link" size="small">撤回</Button>
                        </Popconfirm>
                      ) : null}
                      {scheduleItem && detail?.recallBlockReason && !detail.canRecall ? <span style={{ color: 'var(--color-text-secondary)' }}>{detail.recallBlockReason}</span> : null}
                    </Space>
                  );
                },
              },
            ]}
          />
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            message="排程已输出的生产订单，不可再修改排程信息；若需修改，请撤回后重新下推。"
          />
        </Card>
      </div>

      <Modal title="排程规则" open={ruleOpen} onCancel={() => setRuleOpen(false)} onOk={() => setRuleOpen(false)} okText="确定" cancelText="取消" width={1000} destroyOnClose>
        {ruleTable}
      </Modal>
      <ProductionOrderScheduleEditModal productionOrderId={editingProductionOrderId} open={Boolean(editingProductionOrderId)} onClose={() => setEditingProductionOrderId(null)} />
    </div>
  );
}
