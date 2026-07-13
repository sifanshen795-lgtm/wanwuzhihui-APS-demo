import { Button, Card, Form, Input, Picker, Toast } from 'antd-mobile';
import { useState } from 'react';
import { useMesStore } from '../../store/useMesStore';
import { materialName } from '../../utils/display';

export function MaterialTransferPage() {
  const store = useMesStore();
  const baseBarcodes = store.barcodes.filter((b) => b.materialCode === 'MAT-BASE-B' && b.remainingQuantity > 0);
  const [barcodeCode, setBarcodeCode] = useState(baseBarcodes[0]?.code ?? '');
  const [tankCode, setTankCode] = useState(store.tanks[0]?.code ?? '');
  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [tankVisible, setTankVisible] = useState(false);
  return (
    <div>
      <Card title="基准料转储罐">
        <div className="scan-box">基准料从袋装条码转移至虚拟储罐，供多个挤出工单投料。</div>
        <Form
          footer={<Button block color="primary" type="submit">确认转移</Button>}
          onFinish={(values) => {
            try {
              store.transferToTankAction(barcodeCode, tankCode, Number(values.quantity));
              Toast.show('转移成功');
            } catch (e) {
              Toast.show((e as Error).message);
            }
          }}
        >
          <Form.Item label="来源条码"><Button onClick={() => setBarcodeVisible(true)}>{barcodeCode}</Button></Form.Item>
          <Form.Item label="目标储罐"><Button onClick={() => setTankVisible(true)}>{tankCode}</Button></Form.Item>
          <Form.Item name="quantity" label="转移数量" initialValue="100"><Input type="number" /></Form.Item>
        </Form>
      </Card>
      <Card title="储罐状态" style={{ marginTop: 12 }}>{store.tanks.map((tank) => <div key={tank.code}>{tank.name}｜{materialName(store, tank.materialCode)}｜{tank.currentQuantity} {tank.unit}</div>)}</Card>
      <Picker columns={[baseBarcodes.map((b) => ({ label: `${b.code}｜余${b.remainingQuantity}`, value: b.code }))]} visible={barcodeVisible} onClose={() => setBarcodeVisible(false)} onConfirm={(v) => setBarcodeCode(String(v[0]))} />
      <Picker columns={[store.tanks.map((t) => ({ label: `${t.name}｜余${t.currentQuantity}`, value: t.code }))]} visible={tankVisible} onClose={() => setTankVisible(false)} onConfirm={(v) => setTankCode(String(v[0]))} />
    </div>
  );
}
