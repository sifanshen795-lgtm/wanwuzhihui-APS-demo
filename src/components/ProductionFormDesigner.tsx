import { Button, Card, Checkbox, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import type { ProductionForm, ProductionFormField, ProductionFormFieldType } from '../domain/models/mes';

const COMPONENT_LIBRARY: Array<{ type: ProductionFormFieldType; label: string }> = [
  { type: 'input', label: '输入框' },
  { type: 'number', label: '计数器' },
  { type: 'radio', label: '单选框' },
  { type: 'checkbox', label: '多选框' },
  { type: 'select', label: '选择器' },
  { type: 'date', label: '日期' },
  { type: 'upload', label: '上传' },
  { type: 'text', label: '文字' },
];

const createField = (type: ProductionFormFieldType, index: number): ProductionFormField => ({
  id: `field-${Date.now()}-${index}`,
  type,
  label: `${COMPONENT_LIBRARY.find((item) => item.type === type)?.label ?? '字段'}${index + 1}`,
  fieldCode: `field_${index + 1}`,
  required: false,
  options: type === 'radio' || type === 'checkbox' || type === 'select' ? ['选项1', '选项2'] : undefined,
});

type ProductionFormDesignerProps = {
  open: boolean;
  form: ProductionForm | null;
  onCancel: () => void;
  onSave: (fields: ProductionFormField[]) => void;
};

export function ProductionFormDesigner({ open, form, onCancel, onSave }: ProductionFormDesignerProps) {
  const [fields, setFields] = useState<ProductionFormField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<ProductionFormFieldType | null>(null);

  useEffect(() => {
    if (!open || !form) return;
    setFields(form.fields.map((item) => ({ ...item })));
    setSelectedId(form.fields[0]?.id ?? null);
  }, [form, open]);

  const selectedField = useMemo(
    () => fields.find((item) => item.id === selectedId) ?? null,
    [fields, selectedId],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingType) return;
    const nextField = createField(draggingType, fields.length);
    setFields((prev) => [...prev, nextField]);
    setSelectedId(nextField.id);
    setDraggingType(null);
  };

  const updateSelectedField = (patch: Partial<ProductionFormField>) => {
    if (!selectedField) return;
    setFields((prev) => prev.map((item) => item.id === selectedField.id ? { ...item, ...patch } : item));
  };

  const moveField = (fieldId: string, direction: -1 | 1) => {
    setFields((prev) => {
      const index = prev.findIndex((item) => item.id === fieldId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const renderPreview = (field: ProductionFormField) => {
    const label = (
      <span>
        {field.required ? <span style={{ color: '#ff4d4f' }}>* </span> : null}
        {field.label}
      </span>
    );
    switch (field.type) {
      case 'number':
        return <Form.Item label={label}><Input type="number" placeholder={field.placeholder ?? '请输入'} disabled /></Form.Item>;
      case 'date':
        return <Form.Item label={label}><Input placeholder="选择日期" disabled /></Form.Item>;
      case 'upload':
        return <Form.Item label={label}><Button disabled>点击上传</Button></Form.Item>;
      case 'text':
        return <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>{field.defaultValue || field.label}</Typography.Paragraph>;
      case 'radio':
      case 'checkbox':
      case 'select':
        return (
          <Form.Item label={label}>
            <Select disabled mode={field.type === 'checkbox' ? 'multiple' : undefined} options={(field.options ?? []).map((item) => ({ value: item, label: item }))} placeholder="请选择" />
          </Form.Item>
        );
      default:
        return <Form.Item label={label}><Input placeholder={field.placeholder ?? '请输入'} disabled /></Form.Item>;
    }
  };

  return (
    <Modal
      title={`表单设计器${form ? ` - ${form.name}` : ''}`}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave(fields)}
      okText="保存"
      cancelText="取消"
      width={1200}
      destroyOnClose
      styles={{ body: { paddingTop: 12 } }}
    >
      <div className="form-designer-layout">
        <Card size="small" title="组件" className="form-designer-panel">
          <Space direction="vertical" style={{ width: '100%' }}>
            {COMPONENT_LIBRARY.map((item) => (
              <Button
                key={item.type}
                block
                draggable
                icon={<HolderOutlined />}
                onDragStart={() => setDraggingType(item.type)}
                onDragEnd={() => setDraggingType(null)}
              >
                {item.label}
              </Button>
            ))}
          </Space>
        </Card>

        <Card
          size="small"
          title="画布"
          className="form-designer-canvas"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          {fields.length ? fields.map((field, index) => (
            <div
              key={field.id}
              className={`form-designer-field${selectedId === field.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedId(field.id)}
            >
              <div className="form-designer-field-actions">
                <Space size={0}>
                  <Button type="text" size="small" disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveField(field.id, -1); }}>上移</Button>
                  <Button type="text" size="small" disabled={index === fields.length - 1} onClick={(event) => { event.stopPropagation(); moveField(field.id, 1); }}>下移</Button>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      setFields((prev) => prev.filter((item) => item.id !== field.id));
                      if (selectedId === field.id) setSelectedId(null);
                    }}
                  />
                </Space>
              </div>
              {renderPreview(field)}
            </div>
          )) : (
            <Typography.Text type="secondary">从左侧拖拽组件到此处</Typography.Text>
          )}
        </Card>

        <Card size="small" title="属性" className="form-designer-panel">
          {selectedField ? (
            <Form layout="vertical">
              <Form.Item label="字段名称">
                <Input value={selectedField.label} onChange={(event) => updateSelectedField({ label: event.target.value })} />
              </Form.Item>
              <Form.Item label="字段编码">
                <Input value={selectedField.fieldCode} onChange={(event) => updateSelectedField({ fieldCode: event.target.value })} />
              </Form.Item>
              <Form.Item label="占位提示">
                <Input value={selectedField.placeholder} onChange={(event) => updateSelectedField({ placeholder: event.target.value })} />
              </Form.Item>
              <Form.Item label="默认值">
                <Input value={selectedField.defaultValue} onChange={(event) => updateSelectedField({ defaultValue: event.target.value })} />
              </Form.Item>
              {(selectedField.type === 'radio' || selectedField.type === 'checkbox' || selectedField.type === 'select') && (
                <Form.Item label="选项（逗号分隔）">
                  <Input
                    value={(selectedField.options ?? []).join(',')}
                    onChange={(event) => updateSelectedField({ options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                  />
                </Form.Item>
              )}
              <Form.Item>
                <Checkbox checked={selectedField.required} onChange={(event) => updateSelectedField({ required: event.target.checked })}>必填</Checkbox>
              </Form.Item>
            </Form>
          ) : (
            <Typography.Text type="secondary">选中画布中的字段后可编辑属性</Typography.Text>
          )}
        </Card>
      </div>
    </Modal>
  );
}
