// The forms a work order can carry; a contract may cover only production,
// only development, or both.
export const WORK_ORDER_FORMS = [
  { slug: 'ug-production', label: 'Level Production' },
  { slug: 'ug-development', label: 'Development' },
];

// A new work order starts with the rates from the September workbook.
export const WORK_ORDER_DEFAULTS = {
  number: '',
  description: '',
  ratePerCubicMetre: 990.67,
  drillerWage: 827,
  helperWage: 693,
  wageMarkupPct: 23.33,
  levelIds: [],
  forms: WORK_ORDER_FORMS.map((f) => f.slug),
};

// "-70'L, -370'L" for a work order with populated levels.
export const levelNames = (workOrder) => (workOrder.levelIds || []).map((l) => l.name).join(', ');

// The work order's forms. A copy kept on a phone from before work orders
// had a choice of forms has none listed, which meant both.
export const workOrderForms = (workOrder) => workOrder.forms || WORK_ORDER_FORMS.map((f) => f.slug);

// "Level Production · Development" for a work order.
export const formNames = (workOrder) =>
  WORK_ORDER_FORMS.filter((f) => workOrderForms(workOrder).includes(f.slug))
    .map((f) => f.label)
    .join(' · ');

export const formatRupees = (n) =>
  n == null ? '–' : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;
