import { Badge, Button, Card, Empty, Grid, Space, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { useMesStore } from '../../store/useMesStore';
import { fmt, lineName, materialName } from '../../utils/display';

const formatBatches = (line?: { specifiedBatches?: Array<{ batchNo: string }>; specifiedBatchNo?: string }) => {
  if (!line) return '-';
  const batches = line.specifiedBatches?.length
    ? line.specifiedBatches
    : line.specifiedBatchNo ? [{ batchNo: line.specifiedBatchNo }] : [];
  return batches.length ? batches.map((batch) => batch.batchNo).join('，') : '-';
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useMesStore();
  const workOrder = store.batchWorkOrders.find((w) => w.id === id);
  const formula = store.formulaSheets.find((f) => f.batchWorkOrderId === id);
  const craft = workOrder
    ? store.productionCrafts.find((item) => item.code === workOrder.productionCraftCode)
      ?? store.productionCrafts.find((item) => item.enabled && item.materialCode === workOrder.materialCode)
    : null;
  const nodes = [...(craft?.nodes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const packageRecords = store.packageRecords.filter((item) => item.batchWorkOrderId === id);

  if (!workOrder) return <Card>工单不存在</Card>;

  return (
    <div className="pad-page pad-workorder-detail">
      <div className="pad-detail-layout">
        <aside className="pad-detail-side">
          <Card title="工单信息" className="pad-detail-side-card">
            <div className="pad-info-grid">
              <span>批次工单</span><strong>{workOrder.id}</strong>
              <span>批号</span><strong>{workOrder.batchNo ?? '-'}</strong>
              <span>主产品</span><strong>{materialName(store, workOrder.materialCode)}</strong>
              <span>状态</span><strong><Badge color={workOrder.status === '已完成' ? 'green' : 'blue'} content={workOrder.status} /></strong>
              <span>计划数量</span><strong>{fmt(workOrder.plannedQuantity, workOrder.unit)}</strong>
              <span>产线</span><strong>{lineName(store, workOrder.lineCode)}</strong>
            </div>
            <div className="pad-detail-bom-section">
              <div className="pad-detail-section-title">BOM 总配方</div>
              <div className="pad-muted">数据源：配方单，含物料、配方量、批次、投料口。</div>
              {formula?.lines.length ? (
                <div className="pad-bom-inline">
                  <Grid columns={4} className="pad-bom-table pad-bom-table-head">
                    <Grid.Item>物料</Grid.Item>
                    <Grid.Item>配方量</Grid.Item>
                    <Grid.Item>批次</Grid.Item>
                    <Grid.Item>投料口</Grid.Item>
                  </Grid>
                  {formula.lines.map((line) => (
                    <Grid columns={4} className="pad-bom-table" key={line.id}>
                      <Grid.Item>{materialName(store, line.materialCode)}</Grid.Item>
                      <Grid.Item>{fmt(line.formulaQuantity)}</Grid.Item>
                      <Grid.Item>{formatBatches(line)}</Grid.Item>
                      <Grid.Item>{line.specifiedFeedPort ?? '-'}</Grid.Item>
                    </Grid>
                  ))}
                </div>
              ) : (
                <Empty description="暂无配方明细" />
              )}
            </div>
          </Card>
        </aside>

        <Card title="工艺路线工序卡片列表" className="pad-detail-main">
          {nodes.length ? (
            <div className="pad-process-list">
              {nodes.map((node, index) => {
                const process = store.productionProcesses.find((item) => item.code === node.processCode);
                const materialRows = node.materials.map((material) => {
                  const formulaLine = formula?.lines.find((line) => line.materialCode === material.materialCode);
                  const fedQuantity = store.feedRecords
                    .filter((record) => record.batchWorkOrderId === workOrder.id && record.materialCode === material.materialCode)
                    .reduce((sum, record) => sum + record.actualQuantity, 0);
                  const requiredQuantity = formulaLine?.formulaQuantity ?? 0;
                  return {
                    materialCode: material.materialCode,
                    requiredQuantity,
                    fedQuantity,
                    percent: requiredQuantity ? clampPercent((fedQuantity / requiredQuantity) * 100) : 0,
                  };
                });
                const isDone = materialRows.length > 0 && materialRows.every((row) => row.requiredQuantity > 0 && row.fedQuantity >= row.requiredQuantity);
                const status = workOrder.status === '已完成' || isDone ? '已完工' : workOrder.status === '执行中' && index === 0 ? '生产中' : '待开工';

                return (
                  <div className="pad-process-row" key={node.id}>
                    <div className="pad-process-row-head">
                      <div>
                        <strong>{index + 1}. {process?.name ?? node.processCode}</strong>
                        <span className="pad-process-subtitle">{process?.processAttr ?? '通用'}｜{status}</span>
                      </div>
                      <Badge color={status === '已完工' ? 'green' : status === '生产中' ? 'blue' : 'orange'} content={status} />
                    </div>
                    <div className="pad-process-actions">
                      <Button size="small" onClick={() => { Toast.show('表单执行已记录'); }}>表单执行</Button>
                      <Button size="small" color="primary" disabled={!materialRows.length} onClick={() => navigate(`/app/work-orders/${encodeURIComponent(workOrder.id)}/feeding?nodeId=${encodeURIComponent(node.id)}`)}>投料</Button>
                      {process?.processAttr === '包装' ? (
                        <Button size="small" color="success" onClick={() => navigate(`/app/work-orders/${encodeURIComponent(workOrder.id)}/packaging`)}>包装</Button>
                      ) : null}
                      <Button size="small" color="danger" fill="outline" onClick={() => {
                        store.completeBatchWorkOrderAction(workOrder.id);
                        Toast.show('已记录完工');
                      }}>完工</Button>
                    </div>
                    {materialRows.length ? (
                      <div className="pad-material-progress-list">
                        {materialRows.map((row) => (
                          <div className="pad-material-progress" key={row.materialCode}>
                            <span>{materialName(store, row.materialCode)}</span>
                            <div className="pad-progress-track"><div className="pad-progress-bar" style={{ width: `${row.percent}%` }} /></div>
                            <strong>{fmt(row.fedQuantity)} / {fmt(row.requiredQuantity)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="pad-muted">该工序未配置投料物料</div>
                    )}
                    <div className="pad-history-line">
                      历史投料记录 {store.feedRecords.filter((record) => record.batchWorkOrderId === workOrder.id && node.materials.some((material) => material.materialCode === record.materialCode)).length} 条
                      {process?.processAttr === '包装' ? `｜历史包装记录 ${packageRecords.length} 条` : ''}
                    </div>
                    <div className="pad-abnormal-line">异常工艺参数轮播：温度偏高 195℃，压力波动</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty description="该批次工单未匹配生产工艺或未配置工序" />
          )}
        </Card>
      </div>
    </div>
  );
}
