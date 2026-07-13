import { Button, Card, Input, Select, Space, Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ListPageFooter, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { InventoryLocation, InventoryReservation, InventoryReservationStatus } from '../../domain/models/mes';
import { getActiveReservations, getCurrentReservedQuantity, getPickedQuantity, getReservationLocation, getReturnedQuantity } from '../../domain/services/inventoryReservationService';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

type ReservationDocStatus = '已占用' | '部分占用' | '未占用' | InventoryReservationStatus;

type ReservationRow = InventoryReservation & {
  productCode?: string;
  pickedQuantity: number;
  returnedQuantity: number;
  currentReservedQuantity: number;
  displayStatus: ReservationDocStatus;
};

const resolveReservationStatus = (reservation: InventoryReservation): ReservationDocStatus => {
  if (reservation.status !== '已占用') return reservation.status;
  if (getCurrentReservedQuantity(reservation) <= 0) return '未占用';
  if (reservation.shortageQuantity > 0) return '部分占用';
  return '已占用';
};

type InventoryReservationPageProps = {
  location?: InventoryLocation;
  title?: string;
};

export function InventoryReservationPage({ location = '仓库', title = 'MRP库存占用单' }: InventoryReservationPageProps) {
  const store = useMesStore();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationDocStatus>();
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    statusFilter: undefined as ReservationDocStatus | undefined,
  });
  const [page, setPage] = useState(1);

  const reservationRows = useMemo(() => {
    const existingProductionOrderIds = new Set(store.productionOrders.map((item) => item.id));
    return (store.inventoryReservations ?? [])
      .filter((reservation) => reservation.sourceType === '生产订单')
      .filter((reservation) => existingProductionOrderIds.has(reservation.sourceId))
      .filter((reservation) => getReservationLocation(reservation) === location)
      .map((reservation) => {
        const productionOrder = store.productionOrders.find((item) => item.id === reservation.sourceId);
      return {
        ...reservation,
        productCode: productionOrder?.productCode,
        pickedQuantity: getPickedQuantity(reservation),
        returnedQuantity: getReturnedQuantity(reservation),
        currentReservedQuantity: getCurrentReservedQuantity(reservation),
        displayStatus: resolveReservationStatus(reservation),
      } satisfies ReservationRow;
    });
  }, [location, store.inventoryReservations, store.productionOrders]);

  const rows = useMemo(() => reservationRows
    .filter((row) => !appliedFilters.keyword || `${row.id} ${row.sourceId} ${row.productCode ?? ''} ${row.materialCode}`.includes(appliedFilters.keyword))
    .filter((row) => !appliedFilters.statusFilter || row.displayStatus === appliedFilters.statusFilter), [appliedFilters, reservationRows]);
  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = useMemo(() => rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [effectivePage, rows]);
  const activeReservationCount = getActiveReservations(store.inventoryReservations ?? []).filter((item) => getReservationLocation(item) === location).length;

  useEffect(() => {
    setPage(1);
  }, [appliedFilters.keyword, appliedFilters.statusFilter]);

  const handleSearch = () => setAppliedFilters({ keyword, statusFilter });

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setAppliedFilters({ keyword: '', statusFilter: undefined });
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>{title}</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="占用单号 / MO / 产品" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 300 }} />
          <Select
            allowClear
            placeholder="占用状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            options={[
              { value: '已占用', label: '已占用' },
              { value: '部分占用', label: '部分占用' },
              { value: '未占用', label: '未占用' },
              { value: '已释放', label: '已释放' },
              { value: '已消耗', label: '已消耗' },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">{title}</div>
        <div className="table-actions">
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={pagedRows}
          pagination={false}
          scroll={{ x: 1800 }}
          columns={[
            { title: '占用记录号', dataIndex: 'id', width: 180 },
            { title: '来源类型', dataIndex: 'sourceType', width: 120, render: (value) => <Tag>{value}</Tag> },
            { title: '来源单号', dataIndex: 'sourceId', width: 140 },
            { title: '主产品', dataIndex: 'productCode', width: 220, render: (value) => (value ? materialName(store, value) : '-') },
            { title: '物料', dataIndex: 'materialCode', width: 220, render: (value) => materialName(store, value) },
            { title: '需求数量', dataIndex: 'requiredQuantity', width: 120 },
            { title: '初始占用数量', dataIndex: 'reservedQuantity', width: 130 },
            ...(location === '线边仓'
              ? [{ title: '已退料数量', dataIndex: 'returnedQuantity', width: 120 }]
              : [{ title: '已领料数量', dataIndex: 'pickedQuantity', width: 120 }]),
            { title: '当前占用数量', dataIndex: 'currentReservedQuantity', width: 130 },
            { title: '缺口', dataIndex: 'shortageQuantity', width: 120 },
            { title: '占用状态', dataIndex: 'displayStatus', width: 120, render: (value) => <StatusTag value={value} /> },
            { title: '创建时间', dataIndex: 'createdAt', width: 220 },
          ]}
        />
        <ListPageFooter
          note={`${title}记录生产订单对${location}即时库存的占用；当前占用数量 = 初始占用数量 - ${location === '线边仓' ? '已退料数量' : '已领料数量'}。后续库存可用量按当前占用数量计算。当前有效占用记录 ${activeReservationCount} 条。`}
          current={effectivePage}
          pageSize={pageSize}
          total={rows.length}
          onChange={setPage}
        />
      </Card>
    </div>
  );
}
