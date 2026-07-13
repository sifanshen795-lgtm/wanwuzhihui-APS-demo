import { Badge, Button, Card, Empty, Grid, List, Space, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { BarcodePreview } from '../../components/BarcodePreview';
import { useMesStore } from '../../store/useMesStore';
import { fmt, materialName } from '../../utils/display';

const formatBatches = (line?: { specifiedBatches?: Array<{ batchNo: string }>; specifiedBatchNo?: string }) => {
  if (!line) return '-';
  const batches = line.specifiedBatches?.length
    ? line.specifiedBatches
    : line.specifiedBatchNo ? [{ batchNo: line.specifiedBatchNo }] : [];
  return batches.length ? batches.map((item) => item.batchNo).join('，') : '-';
};

export function ProcessExecutionPadPage() {
  const { formulaId, nodeId } = useParams();
  const store = useMesStore();
  const navigate = useNavigate();
  const formula = store.formulaSheets.find((item) => item.id === formulaId);
  const workOrder = formula ? store.batchWorkOrders.find((item) => item.id === formula.batchWorkOrderId) : null;
  const craft = workOrder
    ? store.productionCrafts.find((item) => item.code === workOrder.productionCraftCode)
      ?? store.productionCrafts.find((item) => item.enabled && item.materialCode === workOrder.materialCode)
    : null;
  const node = craft?.nodes.find((item) => item.id === nodeId);
  const process = node ? store.productionProcesses.find((item) => item.code === node.processCode) : null;
  const packageRecords = workOrder ? store.packageRecords.filter((item) => item.batchWorkOrderId === workOrder.id) : [];

  if (!formula || !workOrder || !craft || !node) {
    return <Card>工序执行信息不存在</Card>;
  }

  const feedMaterials = node.materials
    .map((item) => ({
      materialCode: item.materialCode,
      formulaLine: formula.lines.find((line) => line.materialCode === item.materialCode),
      feedRecords: store.feedRecords.filter((record) => record.batchWorkOrderId === workOrder.id && record.materialCode === item.materialCode),
    }));

  const handleStart = () => {
    try {
      store.startBatchWorkOrderAction(workOrder.id);
      Toast.show('已开始执行');
    } catch (error) {
      Toast.show((error as Error).message);
    }
  };

  const handleEnd = () => {
    try {
      store.completeBatchWorkOrderAction(workOrder.id);
      Toast.show('已结束工序');
    } catch (error) {
      Toast.show((error as Error).message);
    }
  };

  return (
    <div className="pad-page">
      <Card title={process?.name ?? node.processCode}>
        <Space direction="vertical" block>
          <div>
            <Badge color={process?.processAttr === '包装' ? 'green' : 'blue'} content={process?.processAttr ?? '通用'} />
            <span style={{ marginLeft: 8 }}>{workOrder.id}｜{workOrder.batchNo ?? '-'}｜{materialName(store, workOrder.materialCode)}</span>
          </div>
          <div className="pad-muted">状态：{workOrder.status}｜配方：{formula.id}</div>
          <Button block color="primary" size="large" disabled={workOrder.status === '执行中' || workOrder.status === '已完成'} onClick={handleStart}>开始执行</Button>
        </Space>
      </Card>

      {feedMaterials.length ? (
        <Card
          title="投料"
          style={{ marginTop: 12 }}
        >
          <Button block color="primary" size="large" onClick={() => navigate(`/app/work-orders/${encodeURIComponent(workOrder.id)}/feeding`)}>投料</Button>
          <List>
            {feedMaterials.map(({ materialCode, formulaLine, feedRecords }) => (
              <List.Item
                key={materialCode}
                description={`配方用量：${formulaLine ? fmt(formulaLine.formulaQuantity) : '配方单未配置'}｜投料口：${formulaLine?.specifiedFeedPort ?? '-'}｜指定批次：${formatBatches(formulaLine)}`}
              >
                <strong>{materialName(store, materialCode)}</strong>
                <div className="pad-muted">
                  已投料条码：{feedRecords.length ? feedRecords.map((record) => record.barcodeCode ?? record.tankCode ?? record.batchNo).join('，') : '暂无'}
                </div>
              </List.Item>
            ))}
          </List>
        </Card>
      ) : null}

      {process?.processAttr === '包装' ? (
        <Card
          title="包装"
          style={{ marginTop: 12 }}
        >
          <Button block color="success" size="large" onClick={() => navigate(`/app/work-orders/${encodeURIComponent(workOrder.id)}/packaging`)}>包装</Button>
          {packageRecords.length ? (
            <Space direction="vertical" block style={{ marginTop: 12 }}>
              <Grid columns={3} gap={8}>
                {packageRecords.map((record) => (
                  <Grid.Item key={record.id}>
                    <Card className="pad-mini-card">
                      <strong>{record.barcodeCode}</strong>
                      <div className="pad-muted">{fmt(record.weight)}</div>
                    </Card>
                  </Grid.Item>
                ))}
              </Grid>
              <BarcodePreview code={packageRecords[packageRecords.length - 1].barcodeCode} title="最新包装条码" />
            </Space>
          ) : (
            <Empty description="暂无包装条码" />
          )}
        </Card>
      ) : null}

      <Card title="结束工序" style={{ marginTop: 12 }}>
        <Button block color="danger" size="large" disabled={workOrder.status === '已完成'} onClick={handleEnd}>结束工序</Button>
      </Card>
    </div>
  );
}
