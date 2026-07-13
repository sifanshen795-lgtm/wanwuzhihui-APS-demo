export const nowIso = () => new Date().toISOString();

let counter = 1;
export const makeId = (prefix: string) => `${prefix}${String(counter++).padStart(3, '0')}`;

export const resetIdCounter = () => {
  counter = 1;
};

export const round = (value: number, digits = 2) => Number(value.toFixed(digits));
