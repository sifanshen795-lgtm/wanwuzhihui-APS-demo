import { Button, Card, Space, Steps, Table, Tag } from 'antd';
import { DataCard } from '../../components/DataCard';
import { StatusTag } from '../../components/StatusTag';
import { useMesStore } from '../../store/useMesStore';
import { customerName, materialName } from '../../utils/display';
import { scenarioSteps } from '../../mock/scenarioSteps';

export function DashboardPage() {
  const data = useMesStore();
  const active = data.packageRecords.length ? 6 : data.batchWorkOrders.length ? 4 : data.scheduleItems.length ? 2 : data.productionOrders.length ? 1 : 0;
  const submittedOrders = data.salesOrders.filter((order) => order.status === '已提交').map((order) => order.id);
  return (
    <div className="page">
      <div className="page-title">
        <h2>首页看板</h2>
        <Space>
          <Button type="primary" onClick={() => data.pushDownSchedule()}>排程单下推</Button>
        </Space>
      </div>
      <div className="metric-grid">
        <DataCard title="销售订单" value={data.salesOrders.length} />
        <DataCard title="已提交" value={submittedOrders.length} />
        <DataCard title="生产订单" value={data.productionOrders.length} />
        <DataCard title="批次工单" value={data.batchWorkOrders.length} />
      </div>
      <Card className="demo-card" title="Demo 主线进度">
        <Steps current={active} items={scenarioSteps.map((step) => ({ title: step.title, content: step.description }))} />
      </Card>
      <div className="table-toolbar">
        <div className="table-toolbar-title">最近销售订单</div>
      </div>
      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.salesOrders.slice(0, 5)}
          columns={[
            { title: '订单号', dataIndex: 'id' },
            { title: '客户', dataIndex: 'customerCode', render: (v) => customerName(data, v) },
            { title: '产品', dataIndex: 'productCode', render: (v) => materialName(data, v) },
            { title: '数量', dataIndex: 'quantity' },
            { title: '状态', dataIndex: 'status', render: (v) => <StatusTag value={v} /> },
          ]}
        />
      </Card>
      <div className="table-toolbar">
        <div className="table-toolbar-title">最近批次工单</div>
      </div>
      <Card className="demo-card list-card">
        <Table rowKey="id" size="small" pagination={false} dataSource={data.batchWorkOrders.slice(0, 8)} columns={[
          { title: '工单号', dataIndex: 'id' },
          { title: '阶段', dataIndex: 'stage' },
          { title: '物料', dataIndex: 'materialCode', render: (v) => materialName(data, v) },
          { title: '计划数量', dataIndex: 'plannedQuantity' },
          { title: '状态', dataIndex: 'status', render: (v) => <StatusTag value={v} /> },
        ]} />
      </Card>
      <Card className="demo-card" title="执行概览">
        <Space wrap>
          {['草稿', '已提交', '未排程', '已排程', '待下推', '待执行', '执行中', '已完成'].map((status) => (
            <Tag key={status} color={status === '已完成' ? 'green' : status === '执行中' ? 'processing' : 'blue'}>
              {status}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
}
