import { Card, Table } from 'antd';
import { TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import { useMesStore } from '../../store/useMesStore';

export function MrpLogPage() {
  const mrpLogs = useMesStore((s) => s.mrpLogs);

  return (
    <div className="page">
      <div className="page-title">
        <h2>MRP 运算日志</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">MRP 运算日志</div>
        <div className="table-actions"><TableToolIcons /></div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={mrpLogs}
          pagination={false}
          scroll={{ x: 1200 }}
          columns={[
            { title: '运算批号', dataIndex: 'id', width: 140 },
            { title: '运算时间', dataIndex: 'runTime', width: 180 },
            { title: '销售订单', dataIndex: 'salesOrderIds', width: 220, render: (v) => v.join(', ') },
            { title: '生成 MO', dataIndex: 'productionOrderIds', width: 220, render: (v) => v.join(', ') },
            { title: '原料齐套', dataIndex: 'materialReady', width: 100, render: (v) => (v ? '是' : '否') },
            { title: '结果', dataIndex: 'result', width: 100, render: (v) => <StatusTag value={v} /> },
            { title: '备注', dataIndex: 'remark', width: 320, render: (v) => v ?? '-' },
          ]}
        />
      </Card>
    </div>
  );
}
