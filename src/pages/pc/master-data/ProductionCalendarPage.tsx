import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { SelectedCountText, TableToolIcons } from '../../../components/ListPageTools';
import { buildCalendarLabel } from '../../../domain/services/calendarService';
import { useMesStore } from '../../../store/useMesStore';
import { lineName } from '../../../utils/display';

const scopeOptions = [
  { value: '循环', label: '循环' },
  { value: '不循环', label: '不循环' },
];

const recurrenceOptions = [
  { value: '每日', label: '每日' },
  { value: '每周', label: '每周' },
  { value: '每月', label: '每月' },
];

const segmentTypeOptions = [
  { value: '工作', label: '工作' },
  { value: '休息', label: '休息' },
];

const weekdayOptions = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
];

export function ProductionCalendarPage() {
  const data = useMesStore();
  const [open, setOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();
  const scope = Form.useWatch('scope', form);
  const recurrenceType = Form.useWatch('recurrenceType', form);
  const segmentCount = Form.useWatch('segmentCount', form) ?? 2;

  const rows = useMemo(
    () =>
      [...data.productionCalendars]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((calendar) => ({
          ...calendar,
          lineName: lineName(data, calendar.lineCode),
          ruleLabel: buildCalendarLabel(calendar),
        })),
    [data, data.productionCalendars],
  );

  const editingRow = useMemo(
    () => (editingCode ? rows.find((item) => item.code === editingCode) ?? null : null),
    [editingCode, rows],
  );

  useEffect(() => {
    if (!open) return;
    if (editingRow) {
      form.setFieldsValue({
        ...editingRow,
        weekdayValues: editingRow.weekdays ?? [],
        monthDayValues: editingRow.monthDays ?? [],
        segmentCount: editingRow.segments.length,
      });
      editingRow.segments.forEach((segment, index) => {
        form.setFieldValue(['segments', index, 'startTime'], segment.startTime);
        form.setFieldValue(['segments', index, 'endTime'], segment.endTime);
        form.setFieldValue(['segments', index, 'segmentType'], segment.segmentType);
      });
      return;
    }
    form.setFieldsValue({
      scope: '循环',
      recurrenceType: '每日',
      enabled: true,
      segmentCount: 2,
      weekdayValues: [1, 2, 3, 4, 5],
      monthDayValues: [],
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-12-31',
    });
    form.setFieldValue(['segments', 0, 'startTime'], '08:00');
    form.setFieldValue(['segments', 0, 'endTime'], '12:00');
    form.setFieldValue(['segments', 0, 'segmentType'], '工作');
    form.setFieldValue(['segments', 1, 'startTime'], '13:00');
    form.setFieldValue(['segments', 1, 'endTime'], '20:00');
    form.setFieldValue(['segments', 1, 'segmentType'], '工作');
  }, [editingRow, form, open]);

  useEffect(() => {
    if (!open || editingRow) return;
    if (scope === '不循环') {
      form.setFieldsValue({ recurrenceType: undefined, weekdayValues: [], monthDayValues: [] });
    }
    if (recurrenceType === '每日') {
      form.setFieldsValue({ weekdayValues: [], monthDayValues: [] });
    }
    if (recurrenceType === '每周') {
      form.setFieldsValue({ monthDayValues: [] });
    }
    if (recurrenceType === '每月') {
      form.setFieldsValue({ weekdayValues: [] });
    }
  }, [editingRow, form, open, recurrenceType, scope]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    form.resetFields();
    setOpen(true);
  };

  const handleOpenEdit = (code: string) => {
    setEditingCode(code);
    setOpen(true);
  };

  const handleCopy = (row: typeof rows[number]) => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      code: `${row.code}_COPY`,
      lineCode: row.lineCode,
      scope: row.scope,
      recurrenceType: row.recurrenceType,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      enabled: row.enabled,
      remark: row.remark,
      weekdayValues: row.weekdays ?? [],
      monthDayValues: row.monthDays ?? [],
      segmentCount: row.segments.length,
    });
    row.segments.forEach((segment, index) => {
      form.setFieldValue(['segments', index, 'startTime'], segment.startTime);
      form.setFieldValue(['segments', index, 'endTime'], segment.endTime);
      form.setFieldValue(['segments', index, 'segmentType'], segment.segmentType);
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    const segments = Array.from({ length: Number(values.segmentCount ?? 0) || 0 }, (_, index) => ({
      startTime: values?.segments?.[index]?.startTime,
      endTime: values?.segments?.[index]?.endTime,
      segmentType: values?.segments?.[index]?.segmentType,
    })).filter((segment) => segment.startTime && segment.endTime && segment.segmentType);

    const payload = {
      code: values.code,
      lineCode: values.lineCode,
      scope: values.scope,
      recurrenceType: values.scope === '循环' ? values.recurrenceType : undefined,
      weekdays: values.scope === '循环' && values.recurrenceType === '每周' ? values.weekdayValues ?? [] : [],
      monthDays: values.scope === '循环' && values.recurrenceType === '每月' ? (values.monthDayValues ?? []).map((item: string | number) => Number(item)) : [],
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo,
      segments,
      enabled: values.enabled ?? true,
      remark: values.remark,
      createdBy: values.createdBy ?? '斩叶龙',
      createdAt: editingRow?.createdAt ?? dayjs().toISOString(),
    };

    if (editingCode) {
      data.editProductionCalendarAction(editingCode, payload);
      message.success('已更新生产日历');
    } else {
      data.createProductionCalendarAction(payload);
      message.success('已新增生产日历');
    }
    setOpen(false);
    setEditingCode(null);
    form.resetFields();
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>生产日历表</h2>
      </div>

      <Card className="filter-card">
        <Space wrap>
          <Input allowClear placeholder="日历编码" style={{ width: 240 }} />
          <Select allowClear placeholder="产线" style={{ width: 240 }} options={data.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
          <Select allowClear placeholder="循环方式" style={{ width: 180 }} options={scopeOptions} />
          <Button type="primary">查询</Button>
          <Button>重置</Button>
          <Button type="link">展开</Button>
        </Space>
      </Card>

      <div className="table-toolbar">
        <div className="table-toolbar-title">生产日历</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Button type="primary" onClick={handleOpenCreate}>新增</Button>
          <Popconfirm title="确定删除选中的日历吗？" onConfirm={() => { data.batchDeleteProductionCalendarAction(selectedRowKeys.map(String)); setSelectedRowKeys([]); }}>
            <Button danger type="primary" disabled={!selectedRowKeys.length}>批量删除</Button>
          </Popconfirm>
          <Button>导入</Button>
          <Button>批量导出</Button>
          <TableToolIcons />
        </div>
      </div>

      <Card className="demo-card list-card">
        <Table
          rowKey="code"
          dataSource={rows}
          pagination={false}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          scroll={{ x: 1600 }}
          columns={[
            { title: '序号', render: (_, __, index) => index + 1, width: 70 },
            { title: '日历编码', dataIndex: 'code', width: 180 },
            { title: '产线', dataIndex: 'lineName', width: 180 },
            { title: '循环方式', dataIndex: 'scope', width: 100 },
            { title: '重复规则', dataIndex: 'recurrenceType', width: 100, render: (v) => v ?? '-' },
            { title: '生效开始', dataIndex: 'effectiveFrom', width: 120, render: (v) => v ?? '-' },
            { title: '生效结束', dataIndex: 'effectiveTo', width: 120, render: (v) => v ?? '-' },
            { title: '规则描述', dataIndex: 'ruleLabel', width: 340, render: (v) => <span title={v}>{v}</span> },
            { title: '启用状态', dataIndex: 'enabled', width: 100, render: (v) => <span style={{ color: v ? '#52c41a' : '#999' }}>{v ? '启用' : '停用'}</span> },
            { title: '备注', dataIndex: 'remark', width: 160, render: (v) => v ?? '-' },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
            {
              title: '操作',
              width: 160,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => handleCopy(row)}>复制</Button>
                  <Button type="link" onClick={() => handleOpenEdit(row.code)}>编辑</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCode ? '编辑' : '新增'}
        open={open}
        onCancel={() => { setOpen(false); setEditingCode(null); form.resetFields(); }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={1200}
      >
        <Form form={form} layout="vertical" initialValues={{ scope: '循环', recurrenceType: '每日', enabled: true, segmentCount: 2, weekdayValues: [1, 2, 3, 4, 5] }}>
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="日历编码" name="code" rules={[{ required: true, message: '请输入日历编码' }]} style={{ width: 220 }}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
              <Form.Item label="产线" name="lineCode" rules={[{ required: true, message: '请选择产线' }]} style={{ width: 260 }}>
                <Select placeholder="选择" options={data.lines.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
              </Form.Item>
              <Form.Item label="循环方式" name="scope" rules={[{ required: true, message: '请选择循环方式' }]} style={{ width: 180 }}>
                <Select options={scopeOptions} />
              </Form.Item>
              {scope === '循环' ? (
                <Form.Item label="重复规则" name="recurrenceType" rules={[{ required: true, message: '请选择重复规则' }]} style={{ width: 180 }}>
                  <Select options={recurrenceOptions} />
                </Form.Item>
              ) : null}
            </Space>

            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="生效开始" name="effectiveFrom" rules={[{ required: true, message: '请选择生效开始' }]} style={{ width: 200 }}>
                <Input type="date" />
              </Form.Item>
              <Form.Item label="生效结束" name="effectiveTo" rules={[{ required: true, message: '请选择生效结束' }]} style={{ width: 200 }}>
                <Input type="date" />
              </Form.Item>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" style={{ width: 180 }}>
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Space>

            {scope === '循环' && recurrenceType === '每周' ? (
              <Space wrap style={{ width: '100%', marginBottom: 12 }}>
                <Form.Item label="周几" name="weekdayValues" style={{ width: 420 }}>
                  <Select mode="multiple" placeholder="选择周几" options={weekdayOptions} />
                </Form.Item>
              </Space>
            ) : null}

            {scope === '循环' && recurrenceType === '每月' ? (
              <Space wrap style={{ width: '100%', marginBottom: 12 }}>
                <Form.Item label="每月日期" name="monthDayValues" style={{ width: 420 }}>
                  <Select mode="multiple" placeholder="选择日期" options={Array.from({ length: 31 }, (_, index) => ({ value: index + 1, label: `${index + 1}日` }))} />
                </Form.Item>
              </Space>
            ) : null}

            <Space wrap style={{ width: '100%', marginBottom: 12 }}>
              <Form.Item label="段数" name="segmentCount" style={{ width: 120 }}>
                <Input type="number" min={1} max={8} />
              </Form.Item>
            </Space>

            {Array.from({ length: Number(segmentCount) || 0 }, (_, index) => (
              <Space key={index} wrap style={{ width: '100%', marginBottom: 12 }}>
                <Form.Item label={`段 ${index + 1} 开始`} name={['segments', index, 'startTime']} rules={[{ required: true, message: '请输入开始时间' }]} style={{ width: 160 }}>
                  <Input type="time" />
                </Form.Item>
                <Form.Item label={`段 ${index + 1} 结束`} name={['segments', index, 'endTime']} rules={[{ required: true, message: '请输入结束时间' }]} style={{ width: 160 }}>
                  <Input type="time" />
                </Form.Item>
                <Form.Item label={`段 ${index + 1} 类型`} name={['segments', index, 'segmentType']} rules={[{ required: true, message: '请选择类型' }]} style={{ width: 160 }}>
                  <Select options={segmentTypeOptions} />
                </Form.Item>
              </Space>
            ))}

            <Space wrap style={{ width: '100%' }}>
              <Form.Item label="备注" name="remark" style={{ width: 520 }}>
                <Input.TextArea rows={3} placeholder="输入备注" />
              </Form.Item>
            </Space>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
