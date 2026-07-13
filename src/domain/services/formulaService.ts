import type { FormulaSheet, MesStateData } from '../models/mes';
import { getDirectMaterialRequirements } from './bomRequirementService';

export function generateFormulaSheets(data: MesStateData, workOrders = data.batchWorkOrders): FormulaSheet[] {
  return workOrders.map((workOrder) => {
    const productionOrder = data.productionOrders.find((order) => order.id === workOrder.productionOrderId);
    const requirements = getDirectMaterialRequirements(
      data.materialRequirements,
      workOrder.productionOrderId,
      workOrder.materialCode,
    );

    return {
      id: `F-${workOrder.id}`,
      batchWorkOrderId: workOrder.id,
      materialCode: workOrder.materialCode,
      status: '待审核',
      lines: requirements.map((item, index) => {
        const orderQuantity = Math.max(1, productionOrder?.quantity ?? 1);
        const formulaQuantity = Number(((item.requiredQuantity / orderQuantity) * workOrder.plannedQuantity).toFixed(2));
        return {
          id: `FL-${workOrder.id}-${index + 1}`,
          materialCode: item.materialCode,
          formulaQuantity,
          ratio: workOrder.plannedQuantity ? Number((formulaQuantity / workOrder.plannedQuantity).toFixed(4)) : 0,
          specifiedBatches: [],
          specifiedFeedPort: item.feedPort,
        };
      }),
    };
  });
}
