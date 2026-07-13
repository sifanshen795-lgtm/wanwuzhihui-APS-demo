import type { MaterialRequirement, MesStateData } from '../models/mes';

export const getDirectMaterialRequirements = (
  materialRequirements: MaterialRequirement[],
  productionOrderId: string,
  productMaterialCode: string,
) => materialRequirements.filter(
  (item) => item.productionOrderId === productionOrderId && item.productCode === productMaterialCode,
);

export const isSelfMadeMaterialRequirement = (
  data: MesStateData,
  requirement: MaterialRequirement,
) => {
  const material = data.materials.find((item) => item.code === requirement.materialCode);
  return requirement.materialAttr === '自制' && material?.materialAttr !== '外购';
};

export const getSelfMadeDirectChildRequirements = (
  data: MesStateData,
  productionOrderId: string,
  parentMaterialCode: string,
) => getDirectMaterialRequirements(data.materialRequirements, productionOrderId, parentMaterialCode)
  .filter((requirement) => isSelfMadeMaterialRequirement(data, requirement));
