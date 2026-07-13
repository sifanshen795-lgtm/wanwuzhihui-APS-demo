import { Card, Statistic } from 'antd';

export function DataCard({ title, value, suffix }: { title: string; value: number | string; suffix?: string }) {
  return (
    <Card className="demo-card">
      <Statistic title={title} value={value} suffix={suffix} />
    </Card>
  );
}
