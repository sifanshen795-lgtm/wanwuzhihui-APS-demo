import { Button, Card, Space } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';

export function AppHomePage() {
  const navigate = useNavigate();
  return (
    <div className="pad-home">
      <Card title="现场操作">
        <Space direction="vertical" block style={{ '--gap': '16px' }}>
          <Button block color="primary" size="large" onClick={() => navigate('/app/work-orders')}>批次工单</Button>
          <Button block color="primary" fill="outline" size="large" onClick={() => navigate('/app/quick-feed')}>投料快捷入口</Button>
          <Button block size="large" onClick={() => navigate('/app/transfer')}>物料转移</Button>
        </Space>
      </Card>
    </div>
  );
}
