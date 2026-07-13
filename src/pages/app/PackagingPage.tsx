import { Badge, Button, Card, Dialog, Form, Input, Space, Toast } from 'antd-mobile';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarcodePreview } from '../../components/BarcodePreview';
import { useMesStore } from '../../store/useMesStore';
import { fmt, lineName, materialName } from '../../utils/display';

export function PackagingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useMesStore();
  const [form] = Form.useForm<{ weight: string }>();
  const [printBarcodeCode, setPrintBarcodeCode] = useState('');
  const workOrder = store.batchWorkOrders.find((w) => w.id === id);
  const packages = useMemo(() => store.packageRecords
    .filter((p) => p.batchWorkOrderId === id)
    .sort((a, b) => b.packageNo - a.packageNo), [id, store.packageRecords]);
  const packedWeight = packages.reduce((sum, item) => Number((sum + item.weight).toFixed(2)), 0);
  const defaultWeight = workOrder?.type === '主产品' ? '25' : '50';
  if (!workOrder) return <Card>工单不存在</Card>;

  const handlePrint = (barcodeCode: string) => {
    setPrintBarcodeCode(barcodeCode);
    Toast.show(`已发送打印：${barcodeCode}`);
    window.setTimeout(() => window.print(), 0);
  };

  const handleDelete = (barcodeCode: string) => {
    Dialog.confirm({
      content: `确认删除条码 ${barcodeCode}？`,
      onConfirm: async () => {
        try {
          store.deletePackageBarcodeAction(barcodeCode);
          Toast.show('已删除条码');
        } catch (error) {
          Toast.show((error as Error).message);
        }
      },
    });
  };

  return (
    <div className="pad-page pad-packaging-page">
      <div className="pad-packaging-layout">
        <aside className="pad-packaging-side">
          <Card title="包装打码" className="pad-packaging-info-card">
            <div className="pad-info-grid">
              <span>批次工单</span><strong>{workOrder.id}</strong>
              <span>生产订单</span><strong>{workOrder.productionOrderId}</strong>
              <span>批号</span><strong>{workOrder.batchNo}</strong>
              <span>物料</span><strong>{materialName(store, workOrder.materialCode)}</strong>
              <span>计划数量</span><strong>{fmt(workOrder.plannedQuantity, workOrder.unit)}</strong>
              <span>已包装</span><strong>{fmt(packedWeight, workOrder.unit)} / {packages.length} 条</strong>
              <span>产线</span><strong>{lineName(store, workOrder.lineCode)}</strong>
              <span>状态</span><strong><Badge color={workOrder.status === '已完成' ? 'green' : 'blue'} content={workOrder.status} /></strong>
            </div>
            <Button block className="pad-packaging-back-button" onClick={() => navigate(`/app/work-orders/${encodeURIComponent(workOrder.id)}`)}>返回工单</Button>
          </Card>
        </aside>

        <div className="pad-packaging-main">
          <Card title="称重与条码建档">
            <Form
              form={form}
              initialValues={{ weight: defaultWeight }}
              footer={(
                <Space direction="vertical" block>
                  <Button block onClick={() => { form.setFieldsValue({ weight: defaultWeight }); Toast.show('已获取称重'); }}>获取重量</Button>
                  <Button block color="success" type="submit">生成条码并打印</Button>
                </Space>
              )}
              onFinish={(values) => {
                try {
                  const weight = Number(values.weight);
                  store.packageWorkOrderAction(workOrder.id, weight);
                  const latestPackages = useMesStore.getState().packageRecords.filter((p) => p.batchWorkOrderId === workOrder.id);
                  const latest = latestPackages[latestPackages.length - 1];
                  Toast.show('条码已建档至线边仓');
                  if (latest) handlePrint(latest.barcodeCode);
                } catch (e) {
                  Toast.show((e as Error).message);
                }
              }}
            >
              <Form.Item name="weight" label="电子秤重量" rules={[{ required: true, message: '请输入电子秤重量' }]}>
                <Input type="number" placeholder="请输入或获取重量" />
              </Form.Item>
            </Form>
          </Card>

          <Card title="已生成条码列表" style={{ marginTop: 12 }}>
            <div className="pad-barcode-table">
              <div className="pad-barcode-table-row pad-barcode-table-head">
                <span>条码号</span>
                <span>重量</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {packages.map((item) => {
                const barcode = store.barcodes.find((entry) => entry.code === item.barcodeCode);
                return (
                  <div className="pad-barcode-table-row" key={item.id}>
                    <strong>{item.barcodeCode}</strong>
                    <span>{fmt(item.weight, workOrder.unit)}</span>
                    <span>{barcode?.inventoryStatus ?? '-'}</span>
                    <Space>
                      <Button size="mini" onClick={() => handlePrint(item.barcodeCode)}>打印</Button>
                      <Button size="mini" color="danger" fill="outline" onClick={() => handleDelete(item.barcodeCode)}>删除</Button>
                    </Space>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {printBarcodeCode ? <div className="pad-print-label"><BarcodePreview code={printBarcodeCode} title="打印标签" /></div> : null}
    </div>
  );
}
