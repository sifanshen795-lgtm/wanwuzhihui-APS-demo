import type { KitReadyStatus } from '../domain/models/mes';

export const salesOrderKitStatusLabel: Record<KitReadyStatus, string> = {
  未评估: 'MRP未评估',
  齐套: 'MRP满足',
  部分齐套: 'MRP部分满足',
  不齐套: 'MRP不满足',
};

export const productionOrderKitStatusLabel: Record<Exclude<KitReadyStatus, '未评估'>, string> = {
  齐套: '库存齐套',
  部分齐套: '库存部分齐套',
  不齐套: '库存不齐套',
};

export const salesOrderKitStatusColor = (status: KitReadyStatus) => {
  if (status === '齐套') return 'green';
  if (status === '部分齐套') return 'orange';
  if (status === '不齐套') return 'red';
  return 'default';
};

export const productionOrderKitStatusColor = (status: Exclude<KitReadyStatus, '未评估'>) => {
  if (status === '齐套') return 'green';
  if (status === '部分齐套') return 'orange';
  return 'red';
};

export const formatSalesOrderKitText = (
  status: KitReadyStatus,
  kitReadyQuantity: number,
  quantity: number,
) => {
  if (status === '未评估') return salesOrderKitStatusLabel.未评估;
  return `${salesOrderKitStatusLabel[status]}（${kitReadyQuantity}/${quantity}）`;
};

export const formatProductionOrderKitText = (
  status: Exclude<KitReadyStatus, '未评估'>,
  kitReadyQuantity: number,
  quantity: number,
) => `${productionOrderKitStatusLabel[status]}（${kitReadyQuantity}/${quantity}）`;
