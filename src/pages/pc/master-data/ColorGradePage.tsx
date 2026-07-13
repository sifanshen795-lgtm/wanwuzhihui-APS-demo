import { Card, Table } from 'antd';
import { useMesStore } from '../../../store/useMesStore';

export function ColorGradePage() {
  const colorGrades = useMesStore((s) => s.colorGrades);

  return (
    <div className="page">
      <div className="page-title">
        <h2>色级列表</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">色级列表</div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={[...colorGrades].sort((a, b) => a.sort - b.sort)}
          pagination={false}
          columns={[
            { title: '排序', dataIndex: 'sort', width: 100 },
            { title: '色级编码', dataIndex: 'code', width: 160 },
            { title: '色级名称', dataIndex: 'name' },
            { title: '说明', render: (_, __, index) => index === 0 ? '越靠前颜色越浅，用于由浅至深排程' : '' },
          ]}
        />
      </Card>
    </div>
  );
}
