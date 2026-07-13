import { Badge, Button, Card, Empty, List, Space } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

export function FormulaListPadPage() {
  const store = useMesStore();
  const navigate = useNavigate();
  const rows = store.formulaSheets.map((formula) => ({
    formula,
    workOrder: store.batchWorkOrders.find((item) => item.id === formula.batchWorkOrderId),
  }));

  return (
    <div className="pad-page">
      <Card title="配方单">
        {rows.length ? (
          <List>
            {rows.map(({ formula, workOrder }) => (
              <List.Item
                key={formula.id}
                description={`批次工单：${formula.batchWorkOrderId}｜批号：${workOrder?.batchNo ?? '-'}｜物料：${materialName(store, formula.materialCode)}`}
                extra={(
                  <Space>
                    <Badge color={formula.status === '已审核' ? 'green' : 'blue'} content={formula.status} />
                    <Button size="small" color="primary" onClick={() => navigate(`/app/formulas/${encodeURIComponent(formula.id)}`)}>查看</Button>
                  </Space>
                )}
              >
                {formula.id}
              </List.Item>
            ))}
          </List>
        ) : (
          <Empty description="暂无配方单，请先在 PC 端排程下推并生成配方单" />
        )}
      </Card>
    </div>
  );
}
