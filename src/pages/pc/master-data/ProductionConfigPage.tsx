import { Card, Checkbox, Space, Switch, Typography } from 'antd';
import type { CheckboxOptionType } from 'antd/es/checkbox';
import type { MrpAutoPushMergeField } from '../../../domain/models/mes';
import { useMesStore } from '../../../store/useMesStore';

const mergeFieldOptions: CheckboxOptionType<MrpAutoPushMergeField>[] = [
  { label: '物料编码一致', value: 'productCode', disabled: true },
  { label: '交期一致', value: 'deliveryDate' },
  { label: '客户一致', value: 'customerCode' },
  { label: '业务来源一致', value: 'demandSource' },
  { label: '单位一致', value: 'unit' },
  { label: '包装要求一致', value: 'packageRequirement' },
];

export function ProductionConfigPage() {
  const data = useMesStore();
  const updateRule = (patch: Partial<typeof data.mrpRule>) => {
    data.updateMrpRuleAction({ ...data.mrpRule, ...patch });
  };

  return (
    <div className="page">
      <div className="page-title"><h2>MRP 规则设置</h2></div>
      <Card className="demo-card" title="自动下推规则">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space direction="vertical" size={4}>
            <Typography.Text strong>MRP 后自动生成生产订单</Typography.Text>
            <Switch checked={data.mrpRule.autoPushEnabled} checkedChildren="开启" unCheckedChildren="关闭" onChange={(checked) => updateRule({ autoPushEnabled: checked })} />
            <Typography.Text type="secondary">关闭后，MRP 只计算齐套和缺料，不自动下推生产订单。</Typography.Text>
          </Space>

          <Space direction="vertical" size={4}>
            <Typography.Text strong>部分齐套自动拆分</Typography.Text>
            <Switch checked={data.mrpRule.autoPushPartialKitReady} checkedChildren="开启" unCheckedChildren="关闭" disabled={!data.mrpRule.autoPushEnabled} onChange={(checked) => updateRule({ autoPushPartialKitReady: checked })} />
            <Typography.Text type="secondary">开启时，部分齐套销售订单只自动下推齐套数量；关闭时，仅全量齐套订单自动下推。</Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card className="demo-card" title="自动合并规则" style={{ marginTop: 16 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Text type="secondary">勾选的条件必须同时满足，才允许多张销售订单合并生成同一张生产订单。</Typography.Text>
          <Checkbox.Group
            options={mergeFieldOptions}
            value={data.mrpRule.autoPushMergeFields}
            onChange={(values) => updateRule({ autoPushMergeFields: ['productCode', ...(values as MrpAutoPushMergeField[]).filter((value) => value !== 'productCode')] })}
          />
        </Space>
      </Card>
    </div>
  );
}
