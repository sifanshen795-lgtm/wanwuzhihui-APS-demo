import { Button, Card, Space, Toast } from 'antd-mobile';

export function DeviceRunPage() {
  return <Card title="设备运行"><Space direction="vertical" block>
    {['开机','停机','故障','恢复','结束运行'].map((action) => <Button key={action} block onClick={() => { Toast.show(`已记录：${action}`); }}>{action}</Button>)}
  </Space></Card>;
}
