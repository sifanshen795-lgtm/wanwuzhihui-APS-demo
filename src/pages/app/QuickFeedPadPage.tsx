import { Button, Card, Empty, List, Picker, Space } from 'antd-mobile';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

export function QuickFeedPadPage() {
  const store = useMesStore();
  const navigate = useNavigate();
  const [pickerVisible, setPickerVisible] = useState(false);
  const availableWorkOrders = store.batchWorkOrders.filter((item) => item.status !== '已完成');
  const workOrderOptions = useMemo(
    () => availableWorkOrders.map((item) => ({ label: `${item.id}｜${materialName(store, item.materialCode)}｜${item.stage}`, value: item.id })),
    [availableWorkOrders, store.materials],
  );

  const latestWorkOrders = availableWorkOrders.slice(0, 5);

  return (
    <div className="pad-page pad-quick-feed-page">
      <Card title="投料快捷入口">
        <div className="pad-scan-panel">
          <div className="pad-scan-corners" />
          <strong>扫描工单条码</strong>
          <span>Demo 可点击下方按钮选择工单，自动进入工单综合详情</span>
        </div>
        <Space block style={{ marginTop: 16 }}>
          <Button block color="primary" size="large" onClick={() => setPickerVisible(true)}>选择工单</Button>
        </Space>
      </Card>

      <Card title="最近待执行工单" style={{ marginTop: 16 }}>
        {latestWorkOrders.length ? (
          <List>
            {latestWorkOrders.map((workOrder) => (
              <List.Item
                key={workOrder.id}
                clickable
                onClick={() => navigate(`/app/work-orders/${encodeURIComponent(workOrder.id)}`)}
                description={`${workOrder.stage}｜批号 ${workOrder.batchNo ?? '-'}｜${workOrder.plannedQuantity} ${workOrder.unit}`}
                extra={<span style={{ color: 'var(--color-primary)' }}>进入</span>}
              >
                <strong>{workOrder.id}</strong>
                <div>{materialName(store, workOrder.materialCode)}</div>
              </List.Item>
            ))}
          </List>
        ) : (
          <Empty description="暂无可投料工单，请先在 PC 端下推排程" />
        )}
      </Card>

      <Picker
        columns={[workOrderOptions]}
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onConfirm={(values) => {
          const workOrderId = String(values[0] ?? '');
          if (workOrderId) navigate(`/app/work-orders/${encodeURIComponent(workOrderId)}`);
        }}
      />
    </div>
  );
}
