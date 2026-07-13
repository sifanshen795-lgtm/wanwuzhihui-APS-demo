import { Button, Card, Empty, Grid, Input, Picker, Toast } from 'antd-mobile';
import type { InputRef } from 'antd-mobile/es/components/input';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMesStore } from '../../store/useMesStore';
import { fmt, materialName } from '../../utils/display';

interface PendingBarcodeFeed {
  id: string;
  barcodeCode: string;
  materialCode: string;
  batchNo: string;
  scannedQuantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  actualQuantity: number;
  remainingQuantity: number;
  lossQuantity: number;
  feedPort?: string;
}

const toNumber = (value: string) => Number(value || 0);
const round2 = (value: number) => Number(value.toFixed(2));
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export function FeedingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const store = useMesStore();
  const workOrder = store.batchWorkOrders.find((w) => w.id === id);
  const formula = store.formulaSheets.find((f) => f.batchWorkOrderId === id);
  const craft = workOrder
    ? store.productionCrafts.find((item) => item.code === workOrder.productionCraftCode)
      ?? store.productionCrafts.find((item) => item.enabled && item.materialCode === workOrder.materialCode)
    : null;
  const nodes = [...(craft?.nodes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const queryNodeId = searchParams.get('nodeId');
  const activeNode = nodes.find((item) => item.id === queryNodeId) ?? nodes.find((item) => item.materials.length) ?? nodes[0];
  const process = activeNode ? store.productionProcesses.find((item) => item.code === activeNode.processCode) : null;
  const nodeMaterialCodes = activeNode?.materials.map((item) => item.materialCode) ?? [];
  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [barcodeCode, setBarcodeCode] = useState('');
  const [beforeQuantity, setBeforeQuantity] = useState('');
  const [afterQuantity, setAfterQuantity] = useState('');
  const [remainingQuantity, setRemainingQuantity] = useState('');
  const [pendingFeeds, setPendingFeeds] = useState<PendingBarcodeFeed[]>([]);
  const barcodeInputRef = useRef<InputRef>(null);
  const findBarcodeByCode = (code: string) => store.barcodes.find((item) => item.code === code.trim());
  const barcode = findBarcodeByCode(barcodeCode);
  const formulaLine = barcode ? formula?.lines.find((line) => line.materialCode === barcode.materialCode) : undefined;
  const barcodeOptions = useMemo(
    () => store.barcodes
      .filter((item) => item.remainingQuantity > 0 && item.inventoryStatus === '库外' && (!nodeMaterialCodes.length || nodeMaterialCodes.includes(item.materialCode)))
      .map((item) => ({ label: `${item.code}｜${materialName(store, item.materialCode)}｜余 ${item.remainingQuantity} ${item.unit}`, value: item.code })),
    [store.barcodes, store.materials, nodeMaterialCodes.join('|')],
  );
  const actualQuantity = round2(Math.abs(toNumber(beforeQuantity) - toNumber(afterQuantity)));
  const editableRemainingQuantity = toNumber(remainingQuantity);
  const lossQuantity = barcode ? round2(Math.max(0, barcode.remainingQuantity - actualQuantity - editableRemainingQuantity)) : 0;

  const materialProgressRows = nodeMaterialCodes.map((materialCode) => {
    const requiredQuantity = formula?.lines.find((line) => line.materialCode === materialCode)?.formulaQuantity ?? 0;
    const submittedQuantity = store.feedRecords
      .filter((record) => record.batchWorkOrderId === workOrder?.id && record.materialCode === materialCode)
      .reduce((sum, record) => sum + record.actualQuantity, 0);
    const pendingQuantity = pendingFeeds
      .filter((item) => item.materialCode === materialCode)
      .reduce((sum, item) => sum + item.actualQuantity, 0);
    const fedQuantity = round2(submittedQuantity + pendingQuantity);
    return {
      materialCode,
      requiredQuantity,
      fedQuantity,
      remainingQuantity: round2(Math.max(0, requiredQuantity - fedQuantity)),
      percent: requiredQuantity ? clampPercent((fedQuantity / requiredQuantity) * 100) : 0,
    };
  });

  const focusBarcodeInput = () => {
    window.setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.nativeElement?.select();
    }, 0);
  };

  useEffect(() => {
    focusBarcodeInput();
  }, []);

  const resetCurrentBarcode = () => {
    setBarcodeCode('');
    setBeforeQuantity('');
    setAfterQuantity('');
    setRemainingQuantity('');
  };

  const getSpecifiedBatchNos = (line: typeof formulaLine) => {
    if (!line) return [];
    return line.specifiedBatches?.length
      ? line.specifiedBatches.map((item) => item.batchNo)
      : line.specifiedBatchNo ? [line.specifiedBatchNo] : [];
  };

  const getBarcodeValidationError = (targetBarcode: NonNullable<typeof barcode>) => {
    if (targetBarcode.inventoryStatus !== '库外') return '条码库存状态不是库外，不能投料';
    if (nodeMaterialCodes.length && !nodeMaterialCodes.includes(targetBarcode.materialCode)) return '条码物料不属于当前工序';
    const targetFormulaLine = formula?.lines.find((line) => line.materialCode === targetBarcode.materialCode);
    if (!targetFormulaLine) return '条码物料不属于当前配方';
    const specifiedBatchNos = getSpecifiedBatchNos(targetFormulaLine);
    if (specifiedBatchNos.length && !specifiedBatchNos.includes(targetBarcode.batchNo)) return '条码批号与配方单设置不一致';
    return '';
  };

  const handleSelectBarcode = (nextBarcodeCode: string) => {
    const nextBarcode = findBarcodeByCode(nextBarcodeCode);
    if (nextBarcode) {
      const error = getBarcodeValidationError(nextBarcode);
      if (error) {
        Toast.show(error);
        return;
      }
    }
    setBarcodeCode(nextBarcodeCode);
    setBeforeQuantity('');
    setAfterQuantity('');
    setRemainingQuantity(nextBarcode ? String(nextBarcode.remainingQuantity) : '');
    focusBarcodeInput();
  };

  const handleManualBarcodeConfirm = () => {
    const nextBarcode = findBarcodeByCode(barcodeCode);
    if (!barcodeCode.trim()) {
      Toast.show('请输入条码号');
      return;
    }
    if (!nextBarcode) {
      Toast.show('条码不存在');
      return;
    }
    if (nextBarcode.remainingQuantity <= 0) {
      Toast.show('条码已无剩余数量');
      return;
    }
    const error = getBarcodeValidationError(nextBarcode);
    if (error) {
      Toast.show(error);
      return;
    }
    setBarcodeCode(nextBarcode.code);
    setBeforeQuantity('');
    setAfterQuantity('');
    setRemainingQuantity(String(nextBarcode.remainingQuantity));
    Toast.show('条码信息已带出');
    focusBarcodeInput();
  };

  const handleFetchBefore = () => {
    if (!barcode) {
      Toast.show('请先扫描条码');
      return;
    }
    setBeforeQuantity(String(barcode.remainingQuantity));
    focusBarcodeInput();
  };

  const handleFetchAfter = () => {
    if (!barcode) {
      Toast.show('请先扫描条码');
      return;
    }
    const before = toNumber(beforeQuantity) || barcode.remainingQuantity;
    const progressRow = materialProgressRows.find((item) => item.materialCode === barcode.materialCode);
    const suggestedFeedQuantity = Math.min(progressRow?.remainingQuantity || 50, barcode.remainingQuantity, before);
    const after = round2(Math.max(0, before - suggestedFeedQuantity));
    const actual = round2(Math.abs(before - after));
    setBeforeQuantity(String(before));
    setAfterQuantity(String(after));
    setRemainingQuantity(String(round2(Math.max(0, barcode.remainingQuantity - actual))));
    focusBarcodeInput();
  };

  const buildCurrentFeed = (): PendingBarcodeFeed | null => {
    if (!barcode) {
      Toast.show('请先扫描条码');
      return null;
    }
    if (!formulaLine) {
      Toast.show('条码物料不属于当前配方');
      return null;
    }
    if (barcode.inventoryStatus !== '库外') {
      Toast.show('条码库存状态不是库外，不能投料');
      return null;
    }
    if (!nodeMaterialCodes.includes(barcode.materialCode)) {
      Toast.show('条码物料不属于当前工序');
      return null;
    }
    const specifiedBatchNos = getSpecifiedBatchNos(formulaLine);
    if (specifiedBatchNos.length && !specifiedBatchNos.includes(barcode.batchNo)) {
      Toast.show('条码批号与配方单设置不一致');
      return null;
    }
    if (actualQuantity <= 0) {
      Toast.show('请先获取投料前/后重量');
      return null;
    }
    if (editableRemainingQuantity < 0 || editableRemainingQuantity > barcode.remainingQuantity - actualQuantity) {
      Toast.show('条码剩余数量不合理');
      return null;
    }
    return {
      id: `${barcode.code}-${Date.now()}`,
      barcodeCode: barcode.code,
      materialCode: barcode.materialCode,
      batchNo: barcode.batchNo,
      scannedQuantity: barcode.remainingQuantity,
      beforeQuantity: toNumber(beforeQuantity),
      afterQuantity: toNumber(afterQuantity),
      actualQuantity,
      remainingQuantity: editableRemainingQuantity,
      lossQuantity,
      feedPort: formulaLine.specifiedFeedPort,
    };
  };

  const handleContinueScan = () => {
    const feed = buildCurrentFeed();
    if (!feed) return;
    setPendingFeeds((items) => [...items, feed]);
    resetCurrentBarcode();
    focusBarcodeInput();
  };

  const handleSubmit = () => {
    try {
      const currentFeed = barcode ? buildCurrentFeed() : null;
      if (barcode && !currentFeed) return;
      const feedsToSubmit = currentFeed ? [...pendingFeeds, currentFeed] : pendingFeeds;
      if (!feedsToSubmit.length) {
        Toast.show('请先扫码并加入待提交列表');
        return;
      }
      feedsToSubmit.forEach((item) => {
        store.feedByBarcodeAction(workOrder!.id, item.barcodeCode, item.actualQuantity, item.feedPort, item.remainingQuantity);
      });
      setPendingFeeds([]);
      resetCurrentBarcode();
      Toast.show('投料提交成功');
      focusBarcodeInput();
    } catch (error) {
      Toast.show((error as Error).message);
    }
  };

  if (!workOrder || !formula) return <Card>请先生成并审核配方单</Card>;

  return (
    <div className="pad-page pad-feeding-page">
      <Card>
        <Grid columns={3} gap={12}>
          <Grid.Item><div className="pad-header-label">当前工序</div><strong>{process?.name ?? activeNode?.processCode ?? '-'}</strong></Grid.Item>
          <Grid.Item><div className="pad-header-label">工单</div><strong>{workOrder.id}</strong></Grid.Item>
          <Grid.Item><div className="pad-header-label">配方单</div><strong>{formula.id}</strong></Grid.Item>
        </Grid>
      </Card>

      <Card title="本工序物料投料进度" style={{ marginTop: 16 }}>
        {materialProgressRows.length ? (
          <Grid columns={3} gap={12}>
            {materialProgressRows.map((row) => (
              <Grid.Item key={row.materialCode}>
                <div className="pad-material-card">
                  <strong>{materialName(store, row.materialCode)}</strong>
                  <div className="pad-material-stats">
                    <span>应投 {fmt(row.requiredQuantity)}</span>
                    <span>已投 {fmt(row.fedQuantity)}</span>
                    <span>待投 {fmt(row.remainingQuantity)}</span>
                  </div>
                  <div className="pad-progress-track"><div className="pad-progress-bar" style={{ width: `${row.percent}%` }} /></div>
                  <div className="pad-progress-percent">{Math.round(row.percent)}%</div>
                </div>
              </Grid.Item>
            ))}
          </Grid>
        ) : (
          <Empty description="当前工序未配置投料物料" />
        )}
      </Card>

      <div className="pad-scan-panel pad-feeding-scan" onClick={() => setBarcodeVisible(true)}>
        <div className="pad-scan-corners" />
        <strong>PAD 摄像头常驻扫码框</strong>
        <span>扫描原料条码</span>
      </div>

      <Card title="条码投料信息" style={{ marginTop: 16 }}>
        <div className="pad-feed-form">
          <label>
            <span>条码号</span>
            <Input
              ref={barcodeInputRef}
              className="pad-input-editable"
              placeholder="扫码或手输条码号，回车确认"
              value={barcodeCode}
              onChange={(value) => {
                setBarcodeCode(value);
                setBeforeQuantity('');
                setAfterQuantity('');
                setRemainingQuantity('');
              }}
              onEnterPress={handleManualBarcodeConfirm}
            />
          </label>
          <label><span>物料信息</span><Input className="pad-input-readonly" value={barcode ? materialName(store, barcode.materialCode) : ''} readOnly /></label>
          <label><span>批号</span><Input className="pad-input-readonly" value={barcode?.batchNo ?? ''} readOnly /></label>
          <label><span>条码当前数量</span><Input className="pad-input-readonly" value={barcode ? fmt(barcode.remainingQuantity, barcode.unit) : ''} readOnly /></label>
          <label>
            <span>投料前数量</span>
            <div className="pad-input-with-button"><Input className="pad-input-scale" value={beforeQuantity} readOnly /><Button color="primary" onClick={handleFetchBefore}>获取重量</Button></div>
          </label>
          <label>
            <span>投料后数量</span>
            <div className="pad-input-with-button"><Input className="pad-input-scale" value={afterQuantity} readOnly /><Button color="primary" onClick={handleFetchAfter}>获取重量</Button></div>
          </label>
          <label><span>本次投料量</span><Input className="pad-input-calculated" value={actualQuantity ? fmt(actualQuantity) : ''} readOnly /></label>
          <label><span>条码剩余数量</span><Input className="pad-input-editable" value={remainingQuantity} onChange={setRemainingQuantity} onEnterPress={focusBarcodeInput} onBlur={focusBarcodeInput} /></label>
          <label><span>本次损耗量</span><Input className="pad-input-calculated" value={lossQuantity ? fmt(lossQuantity) : '0 kg'} readOnly /></label>
        </div>
      </Card>

      <Card title="多条码待提交" style={{ marginTop: 16 }}>
        {pendingFeeds.length ? (
          <div className="pad-pending-feed-list">
            {pendingFeeds.map((item) => (
              <div className="pad-pending-feed-item" key={item.id}>
                <strong>{item.barcodeCode}</strong>
                <span>{materialName(store, item.materialCode)}</span>
                <span>本次 {fmt(item.actualQuantity)}</span>
                <span>剩余 {fmt(item.remainingQuantity)}</span>
                <span>损耗 {fmt(item.lossQuantity)}</span>
                <Button size="mini" color="danger" fill="none" onClick={() => setPendingFeeds((items) => items.filter((next) => next.id !== item.id))}>删除</Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无待提交条码" />
        )}
      </Card>

      <div className="pad-feed-actions">
        <Button block size="large" fill="outline" color="primary" onClick={handleContinueScan}>继续扫码</Button>
        <Button block size="large" color="primary" onClick={handleSubmit}>确认提交投料</Button>
      </div>

      <Picker
        columns={[barcodeOptions]}
        visible={barcodeVisible}
        onClose={() => {
          setBarcodeVisible(false);
          focusBarcodeInput();
        }}
        onConfirm={(values) => handleSelectBarcode(String(values[0] ?? ''))}
      />
    </div>
  );
}
