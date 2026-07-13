import { Card, Table } from 'antd';
import { useMesStore } from '../../../store/useMesStore';

export function BaseMaterialPage() {
  const data = useMesStore();
  return <div className="page"><div className="page-title"><h2>物料列表</h2></div><Card className="demo-card"><Table rowKey="code" dataSource={data.materials} columns={[{ title: '物料编码', dataIndex: 'code' }, { title: '物料名称', dataIndex: 'name' }, { title: '物料种类', dataIndex: 'type' }, { title: '规格', dataIndex: 'spec' }, { title: '单位', dataIndex: 'unit' }, { title: '色级', dataIndex: 'colorGradeCode', render: (v) => data.colorGrades.find((g) => g.code === v)?.name ?? '-' }]} /></Card></div>;
}
