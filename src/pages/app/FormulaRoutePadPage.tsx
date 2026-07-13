import { Badge, Button, Card, Empty, Grid, Space } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

export function FormulaRoutePadPage() {
  const { formulaId } = useParams();
  const store = useMesStore();
  const navigate = useNavigate();
  const formula = store.formulaSheets.find((item) => item.id === formulaId);
  const workOrder = formula ? store.batchWorkOrders.find((item) => item.id === formula.batchWorkOrderId) : null;
  const craft = workOrder
    ? store.productionCrafts.find((item) => item.code === workOrder.productionCraftCode)
      ?? store.productionCrafts.find((item) => item.enabled && item.materialCode === workOrder.materialCode)
    : null;
  const nodes = [...(craft?.nodes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  if (!formula || !workOrder) {
    return <Card>配方单或批次工单不存在</Card>;
  }

  return (
    <div className="pad-page">
      <Card title={`批次工单 ${workOrder.id}`}>
        <Space direction="vertical" block>
          <div><Badge color={formula.status === '已审核' ? 'green' : 'blue'} content={formula.status} /> <strong>{materialName(store, formula.materialCode)}</strong></div>
          <div className="pad-muted">批号：{workOrder.batchNo ?? '-'} ｜ 工艺：{craft?.name ?? workOrder.productionCraftCode ?? '-'}</div>
        </Space>
      </Card>

      <Card title="工艺路线" style={{ marginTop: 12 }}>
        {nodes.length ? (
          <Grid columns={4} gap={12}>
            {nodes.map((node, index) => {
              const process = store.productionProcesses.find((item) => item.code === node.processCode);
              return (
                <Grid.Item key={node.id}>
                  <Card className="pad-process-card" onClick={() => navigate(`/app/formulas/${encodeURIComponent(formula.id)}/processes/${encodeURIComponent(node.id)}`)}>
                    <Space direction="vertical" block>
                      <Badge color={process?.processAttr === '包装' ? 'green' : 'blue'} content={process?.processAttr ?? '通用'} />
                      <strong>{index + 1}. {process?.name ?? node.processCode}</strong>
                      <span>{node.materials.length ? `投料 ${node.materials.length} 项` : '无投料'}</span>
                      <Button size="small" color="primary">进入执行</Button>
                    </Space>
                  </Card>
                </Grid.Item>
              );
            })}
          </Grid>
        ) : (
          <Empty description="该批次工单未匹配生产工艺或未配置工序" />
        )}
      </Card>
    </div>
  );
}
