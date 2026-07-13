import type { MesStateData } from '../domain/models/mes';

export const materialName = (data: Pick<MesStateData, 'materials'>, code?: string) => data.materials.find((item) => item.code === code)?.name ?? code ?? '-';
export const customerName = (data: Pick<MesStateData, 'customers'>, code?: string) => data.customers.find((item) => item.code === code)?.name ?? code ?? '-';
export const lineName = (data: Pick<MesStateData, 'lines'>, code?: string) => data.lines.find((item) => item.code === code)?.name ?? code ?? '-';
export const tankName = (data: Pick<MesStateData, 'tanks'>, code?: string) => data.tanks.find((item) => item.code === code)?.name ?? code ?? '-';
export const fmt = (value: number | undefined, unit = 'kg') => `${Number(value ?? 0).toLocaleString()} ${unit}`;
