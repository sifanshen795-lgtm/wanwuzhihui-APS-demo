import { DatePicker, Form, InputNumber, Modal, Select, Space, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo } from 'react';
import type { ProductionOrder } from '../domain/models/mes';
import { useMesStore } from '../store/useMesStore';
import { lineName, materialName } from '../utils/display';

type PlanFormValues = {
  lineCode: string;
  singlePotOutput: number;
  singlePotWorkHours: number;
  cleanMinutes: number;
  startAt: Dayjs;
  endAt: Dayjs;
};

type ProductionOrderScheduleEditModalProps = {
  productionOrderId: string | null;
  open: boolean;
  onClose: () => void;
};

const durationToHours = (duration: number, unit: '分钟' | '小时') => (unit === '分钟' ? duration / 60 : duration);
const durationToMinutes = (duration: number, unit: '分钟' | '小时') => (unit === '小时' ? duration * 60 : duration);

const calculatePlan = (quantity: number, singlePotOutput?: number, singlePotWorkHours?: number, cleanMinutes?: number) => {
  const batchCount = Math.max(1, Math.ceil(quantity / Math.max(1, Number(singlePotOutput) || 1)));
  const planWorkHours = Number((batchCount * Math.max(0, Number(singlePotWorkHours) || 0) + Math.max(0, Number(cleanMinutes) || 0) / 60).toFixed(2));
  return { batchCount, planWorkHours };
};

export function ProductionOrderScheduleEditModal({ productionOrderId, open, onClose }: ProductionOrderScheduleEditModalProps) {
  const store = useMesStore();
  const [form] = Form.useForm<PlanFormValues>();
  const watchedValues = Form.useWatch([], form) ?? {};
  const currentOrder = productionOrderId ? store.productionOrders.find((item) => item.id === productionOrderId) : null;
  const previewPlan = currentOrder ? calculatePlan(currentOrder.quantity, watchedValues.singlePotOutput, watchedValues.singlePotWorkHours, watchedValues.cleanMinutes) : null;
  const previewWindowHours = watchedValues.startAt && watchedValues.endAt && watchedValues.endAt.isAfter(watchedValues.startAt)
    ? Number((watchedValues.endAt.diff(watchedValues.startAt, 'minute', true) / 60).toFixed(2))
    : null;

  const productLineOptions = useMemo(() => {
    if (!currentOrder) return [];
    return store.lineProductRelations
      .filter((relation) => relation.enabled && relation.productCode === currentOrder.productCode && store.lines.some((line) => line.code === relation.lineCode && line.enabled))
      .map((relation) => ({ value: relation.lineCode, label: `${relation.lineCode} - ${lineName(store, relation.lineCode)}` }));
  }, [currentOrder, store]);

  const calculatePlanDefaults = (order: ProductionOrder, nextLineCode: string) => {
    const relation = store.lineProductRelations.find((entry) => entry.enabled && entry.productCode === order.productCode && entry.lineCode === nextLineCode);
    if (!relation) return null;
    return {
      singlePotOutput: relation.singlePotOutput,
      singlePotWorkHours: Number(durationToHours(relation.intervalDuration, relation.intervalUnit).toFixed(2)),
      cleanMinutes: durationToMinutes(relation.cleanDuration, relation.cleanUnit),
    };
  };

  const setOrderDefaults = (order: ProductionOrder) => {
    const lineCode = order.lineCode ?? productLineOptions[0]?.value;
    const defaults = lineCode ? calculatePlanDefaults(order, lineCode) : null;
    const singlePotOutput = order.singlePotOutput ?? defaults?.singlePotOutput ?? 1;
    const singlePotWorkHours = order.singlePotWorkHours ?? defaults?.singlePotWorkHours ?? 0;
    const cleanMinutes = order.cleanMinutes ?? defaults?.cleanMinutes ?? 0;
    const plan = calculatePlan(order.quantity, singlePotOutput, singlePotWorkHours, cleanMinutes);
    const startAt = order.plannedStartAt ? dayjs(order.plannedStartAt) : dayjs().add(1, 'day').hour(8).minute(0).second(0).millisecond(0);
    form.setFieldsValue({
      lineCode,
      singlePotOutput,
      singlePotWorkHours,
      cleanMinutes,
      startAt,
      endAt: order.plannedEndAt ? dayjs(order.plannedEndAt) : startAt.add(plan.planWorkHours, 'hour'),
    });
  };

  const handleLineChange = (nextLineCode: string) => {
    if (!currentOrder) return;
    const defaults = calculatePlanDefaults(currentOrder, nextLineCode);
    if (!defaults) return;
    const values = form.getFieldsValue();
    const plan = calculatePlan(currentOrder.quantity, defaults.singlePotOutput, defaults.singlePotWorkHours, defaults.cleanMinutes);
    form.setFieldsValue({
      ...defaults,
      endAt: values.startAt ? values.startAt.add(plan.planWorkHours, 'hour') : values.endAt,
    });
  };

  const handleSavePlan = () => {
    if (!currentOrder) return;
    const values = form.getFieldsValue();
    try {
      if (!values.startAt || !values.endAt || !values.endAt.isAfter(values.startAt)) {
        throw new Error('计划结束必须晚于计划开始');
      }
      store.updateProductionOrderSchedulePlanAction(currentOrder.id, {
        lineCode: values.lineCode,
        singlePotOutput: Number(values.singlePotOutput ?? 1),
        singlePotWorkHours: Number(values.singlePotWorkHours ?? 0),
        cleanMinutes: Number(values.cleanMinutes ?? 0),
        plannedStartAt: values.startAt.toISOString(),
        plannedEndAt: values.endAt.toISOString(),
      });
      message.success('已更新生产订单排程方案');
      form.resetFields();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Modal
      title="编辑生产订单排程"
      open={open}
      afterOpenChange={(nextOpen) => {
        if (nextOpen && currentOrder) setOrderDefaults(currentOrder);
      }}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleSavePlan}
      okText="确定"
      cancelText="取消"
      width={900}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <div>MO：{currentOrder?.id ?? '-'}</div>
        <div>主产品：{currentOrder ? materialName(store, currentOrder.productCode) : '-'}</div>
        <div>数量：{currentOrder?.quantity ?? '-'}</div>
        <div>预计批次数：{previewPlan?.batchCount ?? '-'}</div>
        <div>预计计划工时：{previewPlan ? `${previewPlan.planWorkHours} h` : '-'}</div>
        <div>当前计划时长：{previewWindowHours !== null ? `${previewWindowHours} h` : '-'}</div>
      </Space>
      <Form form={form} layout="vertical">
        <Space wrap style={{ width: '100%' }}>
          <Form.Item label="产线" name="lineCode" rules={[{ required: true, message: '请选择产线' }]} style={{ width: 260 }}>
            <Select options={productLineOptions} placeholder="请选择产线" onChange={handleLineChange} />
          </Form.Item>
          <Form.Item label="单锅产量" name="singlePotOutput" rules={[{ required: true, message: '请输入单锅产量' }]} style={{ width: 180 }}>
            <InputNumber min={1} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="单锅标准工作时长(h)" name="singlePotWorkHours" rules={[{ required: true, message: '请输入单锅标准工作时长' }]} style={{ width: 220 }}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="清机时长(min)" name="cleanMinutes" rules={[{ required: true, message: '请输入清机时长' }]} style={{ width: 180 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="计划开始" name="startAt" rules={[{ required: true, message: '请选择计划开始' }]} style={{ width: 220 }}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="计划结束" name="endAt" rules={[{ required: true, message: '请选择计划结束' }]} style={{ width: 220 }}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}
