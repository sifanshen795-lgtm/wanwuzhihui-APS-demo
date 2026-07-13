import { Button, Card, Col, Form, Input, Modal, Row, Space, Switch, Table, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type Key } from 'react';
import { SelectedCountText, TableToolIcons } from '../../../components/ListPageTools';

type DictionaryItem = {
  code: string;
  name: string;
  remark?: string;
  sort: number;
  enabled: boolean;
};

type DictionaryGroup = {
  code: string;
  name: string;
  remark?: string;
  items: DictionaryItem[];
};

const STORAGE_KEY = 'mes-demo-dictionaries';

const DEFAULT_DICTIONARIES: DictionaryGroup[] = [
  {
    code: 'material-type',
    name: '物料种类',
    remark: '原料 / 中间物料 / 基准料 / 主产品 / 成品',
    items: [
      { code: 'RAW', name: '原料', sort: 1, enabled: true },
      { code: 'MID', name: '中间物料', sort: 2, enabled: true },
      { code: 'BASE', name: '基准料', sort: 3, enabled: true },
      { code: 'PROD', name: '主产品', sort: 4, enabled: true },
      { code: 'FIN', name: '成品', sort: 5, enabled: true },
    ],
  },
  {
    code: 'material-status',
    name: '物料状态',
    remark: '启用 / 停用',
    items: [
      { code: 'ENABLED', name: '启用', sort: 1, enabled: true },
      { code: 'DISABLED', name: '停用', sort: 2, enabled: true },
    ],
  },
  {
    code: 'sales-order-status',
    name: '销售订单状态',
    remark: '草稿 / 未MRP / 已MRP / 已关闭',
    items: [
      { code: 'DRAFT', name: '草稿', sort: 1, enabled: true },
      { code: 'UNMRP', name: '未MRP', sort: 2, enabled: true },
      { code: 'MRP', name: '已MRP', sort: 3, enabled: true },
      { code: 'CLOSED', name: '已关闭', sort: 4, enabled: true },
    ],
  },
  {
    code: 'work-order-status',
    name: '工单状态',
    remark: '待配方 / 待审核 / 待执行 / 执行中 / 暂停中 / 已完成',
    items: [
      { code: 'TO_FORMULA', name: '待配方', sort: 1, enabled: true },
      { code: 'TO_APPROVE', name: '待审核', sort: 2, enabled: true },
      { code: 'TO_EXECUTE', name: '待执行', sort: 3, enabled: true },
      { code: 'RUNNING', name: '执行中', sort: 4, enabled: true },
      { code: 'PAUSED', name: '暂停中', sort: 5, enabled: true },
      { code: 'DONE', name: '已完成', sort: 6, enabled: true },
    ],
  },
];

function loadDictionaries(): DictionaryGroup[] {
  if (typeof window === 'undefined') return DEFAULT_DICTIONARIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DICTIONARIES;
    const parsed = JSON.parse(raw) as DictionaryGroup[];
    return parsed.length ? parsed : DEFAULT_DICTIONARIES;
  } catch {
    return DEFAULT_DICTIONARIES;
  }
}

export function BaseMaterialDictionaryPage() {
  const [dictionaries, setDictionaries] = useState<DictionaryGroup[]>(() => loadDictionaries());
  const [selectedCode, setSelectedCode] = useState<string>(() => loadDictionaries()[0]?.code ?? '');
  const [leftKeyword, setLeftKeyword] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [dictModalOpen, setDictModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [dictForm] = Form.useForm();
  const [itemForm] = Form.useForm();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionaries));
  }, [dictionaries]);

  useEffect(() => {
    if (!selectedCode && dictionaries[0]) setSelectedCode(dictionaries[0].code);
    if (selectedCode && !dictionaries.some((dict) => dict.code === selectedCode) && dictionaries[0]) {
      setSelectedCode(dictionaries[0].code);
    }
  }, [dictionaries, selectedCode]);

  const filteredDicts = useMemo(
    () => dictionaries.filter((dict) => !leftKeyword || dict.code.includes(leftKeyword) || dict.name.includes(leftKeyword)),
    [dictionaries, leftKeyword],
  );

  const selectedDict = dictionaries.find((dict) => dict.code === selectedCode) ?? filteredDicts[0];
  const filteredItems = useMemo(
    () => (selectedDict?.items ?? []).filter((item) => (!itemCode || item.code.includes(itemCode)) && (!itemName || item.name.includes(itemName))),
    [itemCode, itemName, selectedDict],
  );

  const handleCreateDict = () => {
    const values = dictForm.getFieldsValue();
    const next: DictionaryGroup = {
      code: values.code,
      name: values.name,
      remark: values.remark,
      items: [],
    };
    setDictionaries((prev) => [next, ...prev]);
    setSelectedCode(next.code);
    setDictModalOpen(false);
    dictForm.resetFields();
    message.success('已新增数据字典');
  };

  const handleCreateItem = () => {
    if (!selectedDict) return;
    const values = itemForm.getFieldsValue();
    const nextItem: DictionaryItem = {
      code: values.code,
      name: values.name,
      remark: values.remark,
      sort: Number(values.sort ?? 0),
      enabled: values.enabled ?? true,
    };
    setDictionaries((prev) =>
      prev.map((dict) =>
        dict.code === selectedDict.code
          ? { ...dict, items: [nextItem, ...dict.items].sort((a, b) => a.sort - b.sort) }
          : dict,
      ),
    );
    setItemModalOpen(false);
    itemForm.resetFields();
    message.success('已新增字典项');
  };

  const handleToggleItem = (row: DictionaryItem) => {
    if (!selectedDict) return;
    setDictionaries((prev) =>
      prev.map((dict) =>
        dict.code === selectedDict.code
          ? {
              ...dict,
              items: dict.items.map((item) => (item.code === row.code ? { ...item, enabled: !item.enabled } : item)),
            }
          : dict,
      ),
    );
  };

  const handleBatchDeleteItems = () => {
    if (!selectedDict) return;
    setDictionaries((prev) => prev.map((dict) => dict.code === selectedDict.code ? { ...dict, items: dict.items.filter((item) => !selectedRowKeys.includes(item.code)) } : dict));
    setSelectedRowKeys([]);
  };

  return (
    <div className="page">
      <div className="page-title">
        <h2>数据字典</h2>
      </div>

      <div className="table-toolbar">
        <div className="table-toolbar-title">数据字典</div>
      </div>

      <div className="dict-layout">
        <Card className="dict-side-card">
          <div className="dict-side-header">
            <Input.Search
              allowClear
              placeholder="请输入关键字搜索"
              value={leftKeyword}
              onChange={(e) => setLeftKeyword(e.target.value)}
            />
            <Button type="primary" block onClick={() => setDictModalOpen(true)}>新增</Button>
          </div>
          <div className="dict-side-list">
            {filteredDicts.map((dict) => (
              <div
                key={dict.code}
                className={`dict-side-item ${selectedDict?.code === dict.code ? 'dict-side-item-active' : ''}`}
                onClick={() => setSelectedCode(dict.code)}
                role="button"
                tabIndex={0}
              >
                <div className="dict-side-item-title">{dict.name}</div>
                <div className="dict-side-item-subtitle">{dict.code}</div>
                {dict.remark && <div className="dict-side-item-remark">{dict.remark}</div>}
              </div>
            ))}
          </div>
        </Card>

        <div className="dict-main">
          <Card className="filter-card">
            <Space wrap>
              <Input allowClear placeholder="编码" value={itemCode} onChange={(e) => setItemCode(e.target.value)} style={{ width: 220 }} />
              <Input allowClear placeholder="名称" value={itemName} onChange={(e) => setItemName(e.target.value)} style={{ width: 220 }} />
              <Button type="primary">查询</Button>
              <Button onClick={() => { setItemCode(''); setItemName(''); }}>重置</Button>
              <Button type="link">展开</Button>
            </Space>
          </Card>

          <div className="table-toolbar">
            <div className="table-toolbar-title">{selectedDict ? selectedDict.name : '数据列表'}</div>
            <div className="table-actions">
              <SelectedCountText selectedCount={selectedRowKeys.length} />
              <Button type="primary" onClick={() => setItemModalOpen(true)}>新增</Button>
              <Button danger type="primary" disabled={!selectedRowKeys.length} onClick={handleBatchDeleteItems}>批量删除</Button>
              <Button>导入</Button>
              <Button>批量导出</Button>
              <TableToolIcons />
            </div>
          </div>

          <Card className="demo-card list-card">
            <Table
              rowKey="code"
              dataSource={filteredItems}
              pagination={false}
              rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
              scroll={{ x: 900 }}
              columns={[
                { title: '序号', render: (_, __, index) => index + 1, width: 70 },
                { title: '编码', dataIndex: 'code', width: 160 },
                { title: '名称', dataIndex: 'name', width: 220 },
                { title: '备注', dataIndex: 'remark', width: 180, render: (v) => v ?? '-' },
                { title: '启用状态', dataIndex: 'enabled', width: 120, render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag> },
                { title: '操作', width: 120, fixed: 'right', render: (_, row) => <Button type="link" onClick={() => handleToggleItem(row)}>编辑</Button> },
              ]}
            />
          </Card>
        </div>
      </div>

      <Modal title="新增" open={dictModalOpen} onCancel={() => setDictModalOpen(false)} footer={null} destroyOnClose width={900}>
        <Form form={dictForm} layout="vertical" onFinish={handleCreateDict}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="编码" name="code" rules={[{ required: true, message: '请输入编码' }]}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="输入" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} placeholder="输入" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">确定</Button>
              <Button onClick={() => setDictModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新增" open={itemModalOpen} onCancel={() => setItemModalOpen(false)} footer={null} destroyOnClose width={900}>
        <Form form={itemForm} layout="vertical" onFinish={handleCreateItem}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="编码" name="code" rules={[{ required: true, message: '请输入编码' }]}>
                <Input placeholder="输入，唯一" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="排序" name="sort">
                <Input type="number" placeholder="输入，正整数" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="启用状态" name="enabled" valuePropName="checked" initialValue>
                <Switch checkedChildren="启用" unCheckedChildren="停用" defaultChecked />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} placeholder="输入" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">确定</Button>
              <Button onClick={() => setItemModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
