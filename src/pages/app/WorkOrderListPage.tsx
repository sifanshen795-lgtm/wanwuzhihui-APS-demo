import { Badge, Card, Empty, Input, List, Selector } from 'antd-mobile';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProductionStage } from '../../domain/enums';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

export function WorkOrderListPage() {
  const store = useMesStore();
  const navigate = useNavigate();
  const [stage, setStage] = useState<ProductionStage | '全部'>('全部');
  const [keyword, setKeyword] = useState('');
  const normalizedKeyword = keyword.trim().toLowerCase();
  const workOrders = store.batchWorkOrders.filter((w) => {
    if (stage !== '全部' && w.stage !== stage) return false;
    if (!normalizedKeyword) return true;
    const materialDisplayName = materialName(store, w.materialCode);
    return [
      w.id,
      w.materialCode,
      materialDisplayName,
      w.batchNo ?? '',
    ].some((value) => value.toLowerCase().includes(normalizedKeyword));
  });
  const openWorkOrder = (workOrderId: string) => {
    navigate(`/app/work-orders/${encodeURIComponent(workOrderId)}`);
  };
  return (
    <div className="pad-page">
      <Card title="工单查询">
        <Input
          clearable
          placeholder="输入工单号 / 物料 / 批次"
          value={keyword}
          onChange={setKeyword}
        />
      </Card>
      <div style={{ marginTop: 12 }}>
      <Selector value={[stage]} onChange={(v) => setStage(v[0] as ProductionStage | '全部')} options={['全部', '配色', '配料', '挤出'].map((v) => ({ label: v, value: v }))} />
      </div>
      {workOrders.length ? (
        <List style={{ marginTop: 12 }}>
          {workOrders.map((w) => (
            <List.Item
              key={w.id}
              clickable
              onClick={() => openWorkOrder(w.id)}
              description={`${w.stage}｜批号 ${w.batchNo ?? '-'}｜${w.plannedQuantity} ${w.unit}`}
              extra={<span style={{ color: 'var(--color-primary)' }}>进入</span>}
            >
              <Badge color={w.status === '已完成' ? 'green' : 'blue'} content={w.status}><span>{w.id}</span></Badge>
              <div>{materialName(store, w.materialCode)}</div>
            </List.Item>
          ))}
        </List>
      ) : (
        <Card style={{ marginTop: 12 }}><Empty description="暂无工单，请先在 PC 端下推排程" /></Card>
      )}
    </div>
  );
}
