import { Card, Table } from 'antd';

export function CleaningTimePage() {
  return (
    <div className="page">
      <div className="page-title">
        <h2>清机时长对照表</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">清机时长对照表</div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={[
            { code: 'CLN-01', before: '浅色', after: '深色', minutes: 30 },
            { code: 'CLN-02', before: '原料 A', after: '原料 B', minutes: 45 },
          ]}
          pagination={false}
          columns={[
            { title: '对照编码', dataIndex: 'code', width: 180 },
            { title: '换线前', dataIndex: 'before', width: 180 },
            { title: '换线后', dataIndex: 'after', width: 180 },
            { title: '清机时长(min)', dataIndex: 'minutes', width: 140 },
          ]}
        />
      </Card>
    </div>
  );
}
