import { Button, Card, message, Space, Steps, Typography } from 'antd';
import { scenarioSteps } from '../../mock/scenarioSteps';
import { useMesStore } from '../../store/useMesStore';

export function DemoControlPage() {
  const store = useMesStore();
  const run = (fn: () => void, text: string) => {
    try {
      fn();
      message.success(text);
    } catch (error) {
      message.error((error as Error).message);
    }
  };
  const submittedCount = store.salesOrders.filter((o) => o.status === '已提交').length;
  const firstWorkOrder = store.batchWorkOrders.find((item) => item.status === '待执行' || item.status === '执行中' || item.status === '暂停中');
  return (
    <div className="page">
      <div className="page-title">
        <h2>Demo 控制台</h2>
        <Typography.Text type="secondary">一键推进演示主线，避免现场手工操作过多</Typography.Text>
      </div>
      <Card className="demo-card" title="演示脚本">
        <Steps direction="vertical" items={scenarioSteps.map((step) => ({ title: step.title, content: step.description }))} />
      </Card>
      <Card className="demo-card" title="一键动作">
        <Space wrap>
          <Button danger onClick={() => run(store.resetDemo, '已恢复初始 Demo 数据')}>重置 Demo</Button>
          <Button danger onClick={() => run(store.rollbackToPreMrpAction, '已回退到销售订单未 MRP 阶段')}>回退到销售订单未 MRP</Button>
          <Button onClick={() => run(store.saveValidationBaselineAction, '已保存当前基础数据和销售订单为验证基线')}>保存当前为验证基线</Button>
          <Button onClick={() => run(store.restoreValidationBaselineAction, '已回退到验证基线')}>回退到验证基线</Button>
          <Button onClick={() => run(store.createSalesOrderAction, '已生成样例订单')}>生成样例订单</Button>
          <Button type="primary" onClick={() => run(() => store.runMrpForOrders(), 'MRP 运算完成')} disabled={!submittedCount}>执行 MRP</Button>
          <Button onClick={() => {
            const pendingOrder = store.productionOrders.find((item) => item.status === '未排程');
            if (!pendingOrder) {
              message.warning('没有未排程的生产订单');
              return;
            }
            run(() => store.pushProductionOrderToScheduleAction(pendingOrder.id), '已生成排程方案');
          }}>生成排程方案</Button>
          <Button onClick={() => {
            const plannedOrder = store.productionOrders.find((item) => item.status === '已排程' && !store.scheduleItems.some((schedule) => schedule.productionOrderId === item.id));
            if (!plannedOrder) {
              message.warning('没有可输出的已排程生产订单');
              return;
            }
            run(() => store.outputProductionOrdersToScheduleAction([plannedOrder.id]), '已输出排程单');
          }}>输出排程单</Button>
          <Button onClick={() => run(store.pushDownSchedule, '已下推并生成批次工单/配方单')}>排程单下推</Button>
          <Button onClick={() => run(store.approveAllFormulas, '全部配方已审核')}>审核全部配方</Button>
          {firstWorkOrder && <Button onClick={() => run(() => store.startBatchWorkOrderAction(firstWorkOrder.id), '工单已开工')}>工单开工</Button>}
          {firstWorkOrder && <Button onClick={() => run(() => store.completeBatchWorkOrderAction(firstWorkOrder.id), '工单已完工')}>工单完工</Button>}
        </Space>
      </Card>
      <Card className="demo-card" title="当前数据状态">
        <Space size="large" wrap>
          <span>验证基线：{store.validationBaseline?.savedAt ? new Date(store.validationBaseline.savedAt).toLocaleString() : '未保存'}</span>
          <span>销售订单：{store.salesOrders.length}</span>
          <span>生产订单：{store.productionOrders.length}</span>
          <span>排程：{store.scheduleItems.length}</span>
          <span>批次工单：{store.batchWorkOrders.length}</span>
          <span>配方单：{store.formulaSheets.length}</span>
          <span>投料记录：{store.feedRecords.length}</span>
          <span>包装记录：{store.packageRecords.length}</span>
        </Space>
      </Card>
    </div>
  );
}
