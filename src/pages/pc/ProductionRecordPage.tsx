import { Card, Table, Tabs } from 'antd';
import { TableToolIcons } from '../../components/ListPageTools';
import { useMesStore } from '../../store/useMesStore';
import { materialName, tankName } from '../../utils/display';

export function ProductionRecordPage() {
  const store = useMesStore();
  return (
    <div className="page">
      <div className="page-title"><h2>生产记录</h2></div>
      <div className="table-toolbar">
        <div className="table-toolbar-title">生产记录</div>
        <div className="table-actions"><TableToolIcons /></div>
      </div>
      <Card className="demo-card list-card">
        <Tabs items={[
          { key: 'exec', label: '工单执行记录', children: <Table rowKey="id" pagination={false} scroll={{ x: 900 }} dataSource={store.executionRecords} columns={[{ title: '记录号', dataIndex: 'id', width: 160 }, { title: '工单', dataIndex: 'batchWorkOrderId', width: 180 }, { title: '动作', dataIndex: 'action', width: 100 }, { title: '状态', dataIndex: 'status', width: 120 }, { title: '时间', dataIndex: 'startAt', width: 220 }]} /> },
          { key: 'feed', label: '生产投料记录', children: <Table rowKey="id" pagination={false} scroll={{ x: 1100 }} dataSource={store.feedRecords} columns={[{ title: '记录号', dataIndex: 'id', width: 160 }, { title: '工单', dataIndex: 'batchWorkOrderId', width: 180 }, { title: '投料口', dataIndex: 'feedPort', width: 120, render: (v) => v ?? '-' }, { title: '条码/储罐', width: 180, render: (_, r) => r.barcodeCode ?? r.tankCode }, { title: '物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) }, { title: '批号', dataIndex: 'batchNo', width: 160 }, { title: '实投量', dataIndex: 'actualQuantity', width: 120 }]} /> },
          { key: 'pkg', label: '生产包装记录', children: <Table rowKey="id" pagination={false} scroll={{ x: 900 }} dataSource={store.packageRecords} columns={[{ title: '记录号', dataIndex: 'id', width: 160 }, { title: '工单', dataIndex: 'batchWorkOrderId', width: 180 }, { title: '包装序号', dataIndex: 'packageNo', width: 120 }, { title: '物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) }, { title: '重量', dataIndex: 'weight', width: 120 }, { title: '生成条码', dataIndex: 'barcodeCode', width: 180 }]} /> },
          { key: 'transfer', label: '物料转移记录', children: <Table rowKey="id" pagination={false} scroll={{ x: 900 }} dataSource={store.transferRecords} columns={[{ title: '转移单', dataIndex: 'id', width: 160 }, { title: '来源条码', dataIndex: 'sourceBarcodeCode', width: 180 }, { title: '目标储罐', dataIndex: 'targetTankCode', width: 180, render: (v) => tankName(store, v) }, { title: '数量', dataIndex: 'quantity', width: 120 }, { title: '时间', dataIndex: 'transferredAt', width: 220 }]} /> },
          { key: 'loss', label: '物料损耗记录', children: <Table rowKey="id" pagination={false} scroll={{ x: 900 }} dataSource={store.lossRecords} columns={[{ title: '损耗单', dataIndex: 'id', width: 160 }, { title: '来源', dataIndex: 'source', width: 120 }, { title: '条码', dataIndex: 'barcodeCode', width: 180 }, { title: '物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) }, { title: '数量', dataIndex: 'quantity', width: 120 }]} /> },
        ]} />
      </Card>
    </div>
  );
}
