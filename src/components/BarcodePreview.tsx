import { Card } from 'antd';

export function BarcodePreview({ code, title }: { code: string; title?: string }) {
  return (
    <Card size="small" title={title ?? '条码预览'}>
      <div style={{ fontFamily: 'monospace', fontSize: 20, letterSpacing: 2 }}>{code}</div>
      <div style={{ marginTop: 8, height: 42, background: 'repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 5px)' }} />
    </Card>
  );
}
