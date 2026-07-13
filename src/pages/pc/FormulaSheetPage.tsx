import { Button, Card, Descriptions, Form, Input, message, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';
import { useState } from 'react';
import { SelectedCountText, TableToolIcons } from '../../components/ListPageTools';
import { StatusTag } from '../../components/StatusTag';
import type { FormulaSheet } from '../../domain/models/mes';
import { useMesStore } from '../../store/useMesStore';
import { lineName, materialName } from '../../utils/display';

export function FormulaSheetPage() {
  const store = useMesStore();
  const [batchModal, setBatchModal] = useState<{ formulaId: string; lineId: string; materialCode: string; formulaStatus: FormulaSheet['status'] } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchForm] = Form.useForm();
  const rows = store.formulaSheets.map((formula) => {
    const workOrder = store.batchWorkOrders.find((item) => item.id === formula.batchWorkOrderId);
    return {
      ...formula,
      workOrder,
    };
  });
  const selectedPendingFormulaIds = selectedRowKeys
    .map(String)
    .filter((id) => rows.some((row) => row.id === id && row.status === '待审核'));

  const approveSelectedFormulas = () => {
    try {
      selectedPendingFormulaIds.forEach((id) => store.approveFormulaAction(id));
      message.success('已批量审核配方单');
      setSelectedRowKeys([]);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ColumnsType<(typeof rows)[number]> = [
    { title: '配方单号', dataIndex: 'id', width: 240, ellipsis: true },
    { title: '批次工单', dataIndex: 'batchWorkOrderId', width: 240, ellipsis: true },
    { title: '批号', width: 220, render: (_, row) => row.workOrder?.batchNo ?? '-' },
    { title: '工单类型', width: 100, render: (_, row) => row.workOrder?.type ?? '-' },
    { title: '阶段', width: 100, render: (_, row) => row.workOrder?.stage ?? '-' },
    { title: '生产物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) },
    { title: '计划数量', width: 120, render: (_, row) => row.workOrder ? `${row.workOrder.plannedQuantity} ${row.workOrder.unit}` : '-' },
    { title: '产线', width: 180, render: (_, row) => lineName(store, row.workOrder?.lineCode ?? '') },
    { title: '状态', dataIndex: 'status', width: 120, render: (v) => <StatusTag value={v} /> },
    {
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          {row.status === '待审核' ? (
            <Popconfirm
              title="确认审核这张配方单？"
              onConfirm={() => {
                try {
                  store.approveFormulaAction(row.id);
                  message.success('配方单已审核');
                } catch (e) {
                  message.error((e as Error).message);
                }
              }}
            >
              <Button type="link">审核</Button>
            </Popconfirm>
          ) : (
            <Button type="link" disabled>已审核</Button>
          )}
        </Space>
      ),
    },
  ];

  const formatBatches = (line: FormulaSheet['lines'][number]) => {
    const batches = line.specifiedBatches?.length
      ? line.specifiedBatches
      : line.specifiedBatchNo ? [{ batchNo: line.specifiedBatchNo }] : [];
    return batches;
  };

  const openBatchModal = (formula: FormulaSheet, line: FormulaSheet['lines'][number]) => {
    const batches = formatBatches(line);
    batchForm.setFieldsValue({
      batches: batches.length ? batches : [{ batchNo: '' }],
    });
    setBatchModal({ formulaId: formula.id, lineId: line.id, materialCode: line.materialCode, formulaStatus: formula.status });
  };

  const saveBatchModal = () => {
    if (!batchModal) return;
    const values = batchForm.getFieldsValue();
    const batches = (values.batches ?? []) as Array<{ batchNo?: string }>;
    try {
      store.updateFormulaLineBatchesAction(batchModal.formulaId, batchModal.lineId, batches.map((item) => ({ batchNo: item.batchNo ?? '' })));
      message.success('已保存指定批次');
      setBatchModal(null);
      batchForm.resetFields();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const lineColumns = (formula: FormulaSheet): ColumnsType<FormulaSheet['lines'][number]> => [
    { title: '序号', width: 80, render: (_, __, index) => index + 1 },
    { title: '子物料', dataIndex: 'materialCode', width: 220, render: (v) => materialName(store, v) },
    { title: '配方用量', dataIndex: 'formulaQuantity', width: 120 },
    { title: '比例', dataIndex: 'ratio', width: 120 },
    {
      title: '指定批次',
      width: 260,
      render: (_, line) => {
        const batches = formatBatches(line);
        return batches.length ? (
          <Space wrap size={[4, 4]}>
            {batches.map((batch) => <Tag key={batch.batchNo}>{batch.batchNo}</Tag>)}
          </Space>
        ) : '-';
      },
    },
    { title: '指定投料口', dataIndex: 'specifiedFeedPort', width: 160, render: (v) => v ?? '-' },
    {
      title: '操作',
      width: 120,
      render: (_, line) => (
        <Button type="link" disabled={formula.status === '已审核'} onClick={() => openBatchModal(formula, line)}>设置批次</Button>
      ),
    },
  ];
  return (
    <div className="page">
      <div className="page-title"><h2>配方单</h2></div>
      <div className="table-toolbar">
        <div className="table-toolbar-title">配方单</div>
        <div className="table-actions">
          <SelectedCountText selectedCount={selectedRowKeys.length} />
          <Popconfirm title="确认审核选中的待审核配方单？" onConfirm={approveSelectedFormulas}>
            <Button type="primary" disabled={!selectedPendingFormulaIds.length}>批量审核</Button>
          </Popconfirm>
          <TableToolIcons />
        </div>
      </div>
      <Card className="demo-card list-card">
        <Table
          rowKey="id"
          dataSource={rows}
          columns={columns}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            getCheckboxProps: (row) => ({ disabled: row.status !== '待审核' }),
          }}
          scroll={{ x: 1800 }}
          expandable={{
            expandedRowRender: (formula) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Descriptions
                  size="small"
                  column={2}
                  bordered
                  labelStyle={{ width: 120 }}
                  contentStyle={{ wordBreak: 'break-all' }}
                  items={[
                    { key: 'formula', label: '配方单号', children: formula.id },
                    { key: 'wo', label: '批次工单', children: formula.batchWorkOrderId },
                    { key: 'batchNo', label: '批号', children: formula.workOrder?.batchNo ?? '-' },
                    { key: 'status', label: '状态', children: <StatusTag value={formula.status} /> },
                    { key: 'material', label: '生产物料', children: materialName(store, formula.materialCode) },
                    { key: 'qty', label: '计划数量', children: formula.workOrder ? `${formula.workOrder.plannedQuantity} ${formula.workOrder.unit}` : '-' },
                    { key: 'line', label: '产线', children: lineName(store, formula.workOrder?.lineCode ?? '') },
                    { key: 'parent', label: '关联主工单', children: formula.workOrder?.parentBatchWorkOrderId ?? '-' },
                  ]}
                />
                <Table rowKey="id" size="small" pagination={false} scroll={{ x: 1100 }} dataSource={formula.lines} columns={lineColumns(formula)} />
              </Space>
            ),
          }}
        />
      </Card>
      <Modal
        title="设置子物料批次"
        open={Boolean(batchModal)}
        onCancel={() => { setBatchModal(null); batchForm.resetFields(); }}
        onOk={saveBatchModal}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={batchForm} layout="vertical">
          <Form.List name="batches">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ width: '100%' }}>
                    <Form.Item {...field} label="批号" name={[field.name, 'batchNo']} rules={[{ required: true, message: '请输入批号' }]} style={{ width: 360 }}>
                      <Input placeholder="手工输入批号" />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)}>删除</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ batchNo: '' })}>新增批次</Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
