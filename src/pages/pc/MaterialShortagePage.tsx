import { Button, Card, DatePicker, Empty, Input, Select, Space, Table, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { ListPageFooter, TableToolIcons } from '../../components/ListPageTools';
import type { MaterialShortageSummary } from '../../domain/models/mes';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

type AppliedFilters = {
  keyword: string;
  materialAttr?: '外购' | '自制';
  demandDateFrom?: string;
  demandDateTo?: string;
};

const { RangePicker } = DatePicker;

export function MaterialShortagePage() {
  const store = useMesStore();
  const [keyword, setKeyword] = useState('');
  const [materialAttr, setMaterialAttr] = useState<'外购' | '自制'>();
  const [demandDateRange, setDemandDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({ keyword: '' });
  const [page, setPage] = useState(1);

  const rows = useMemo(() => (store.materialShortages ?? [])
    .filter((row) => {
      if (!appliedFilters.keyword) return true;
      const text = `${row.materialCode} ${row.materialName ?? ''}`.toLowerCase();
      return text.includes(appliedFilters.keyword.toLowerCase());
    })
    .filter((row) => !appliedFilters.materialAttr || row.materialAttr === appliedFilters.materialAttr)
    .filter((row) => !appliedFilters.demandDateFrom || row.demandDate >= appliedFilters.demandDateFrom)
    .filter((row) => !appliedFilters.demandDateTo || row.demandDate <= appliedFilters.demandDateTo), [appliedFilters, store.materialShortages]);

  const pageSize = 10;
  const effectivePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = useMemo(
    () => rows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize),
    [effectivePage, rows],
  );

  const latestMrp = store.mrpLogs[store.mrpLogs.length - 1];

  useEffect(() => {
    setPage(1);
  }, [appliedFilters.keyword, appliedFilters.materialAttr, appliedFilters.demandDateFrom, appliedFilters.demandDateTo]);

  const handleSearch = () => {
    setAppliedFilters({
      keyword,
      materialAttr,
      demandDateFrom: demandDateRange?.[0]?.format('YYYY-MM-DD'),
      demandDateTo: demandDateRange?.[1]?.format('YYYY-MM-DD'),
    });
  };

  const handleReset = () => {
    setKeyword('');
    setMaterialAttr(undefined);
    setDemandDateRange(null);
    setAppliedFilters({ keyword: '' });
  };

  const renderPurchaseQuantity = (row: MaterialShortageSummary) => {
    if (row.materialAttr === '外购') {
      return row.suggestedPurchaseQuantity;
    }
    return <Tag color="blue">需转自制/补库存</Tag>;
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>缺料汇总</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input
            allowClear
            placeholder="物料编码 / 名称"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder="物料属性"
            value={materialAttr}
            onChange={setMaterialAttr}
            style={{ width: 160 }}
            options={[
              { value: '外购', label: '外购' },
              { value: '自制', label: '自制' },
            ]}
          />
          <RangePicker
            value={demandDateRange}
            onChange={(value) => setDemandDateRange(value)}
            placeholder={['需求日期起', '需求日期止']}
          />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">缺料汇总</div>
        <div className="table-actions">
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        {!rows.length ? (
          <Empty description="暂无缺料汇总，请先在销售订单页运行 MRP" />
        ) : (
          <Table
            rowKey="id"
            dataSource={pagedRows}
            pagination={false}
            scroll={{ x: 1500 }}
            expandable={{
              expandedRowRender: (row) => (
                <Table
                  size="small"
                  rowKey={(line) => `${row.id}-${line.salesOrderId}`}
                  pagination={false}
                  dataSource={row.sourceLines}
                  columns={[
                    { title: '销售订单', dataIndex: 'salesOrderId', width: 140 },
                    { title: '产品', dataIndex: 'productCode', width: 220, render: (value) => materialName(store, value) },
                    { title: '要货日期', dataIndex: 'deliveryDate', width: 140 },
                    { title: '需求量', dataIndex: 'requiredQuantity', width: 120 },
                    { title: 'MRP可用量', dataIndex: 'availableQuantity', width: 120 },
                    { title: '缺料量', dataIndex: 'shortageQuantity', width: 120 },
                  ]}
                />
              ),
            }}
            columns={[
              { title: '物料', dataIndex: 'materialCode', width: 240, render: (value, row) => materialName(store, value) || row.materialName || value },
              { title: '物料属性', dataIndex: 'materialAttr', width: 100, render: (value) => <Tag>{value}</Tag> },
              { title: '需求日期', dataIndex: 'demandDate', width: 120 },
              { title: '需求总量', dataIndex: 'requiredQuantity', width: 120 },
              { title: 'MRP可用量', dataIndex: 'availableQuantity', width: 120 },
              { title: '缺料量', dataIndex: 'shortageQuantity', width: 120 },
              { title: '建议采购量', dataIndex: 'suggestedPurchaseQuantity', width: 140, render: (_, row) => renderPurchaseQuantity(row) },
              { title: '关联销售订单', dataIndex: 'salesOrderIds', width: 220, render: (value: string[]) => value.join(', ') },
              { title: 'MRP批号', dataIndex: 'mrpLogId', width: 120 },
              { title: 'MRP时间', dataIndex: 'mrpRunTime', width: 200, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
            ]}
          />
        )}
        <ListPageFooter
          note={`缺料汇总由最近一次 MRP 生成，按物料 + 需求日期聚合；建议采购量仅对外购物料等于缺料量，自制物料需转自制或补库存处理。${latestMrp ? ` 最近 MRP：${latestMrp.id}（${dayjs(latestMrp.runTime).format('YYYY-MM-DD HH:mm:ss')}）` : ''}`}
          current={effectivePage}
          pageSize={pageSize}
          total={rows.length}
          onChange={setPage}
        />
      </Card>
    </div>
  );
}
