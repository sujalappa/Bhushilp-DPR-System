// A new work order starts with the rates from the September workbook.
export const WORK_ORDER_DEFAULTS = {
  number: '',
  description: '',
  ratePerCubicMetre: 990.67,
  drillerWage: 827,
  helperWage: 693,
  wageMarkupPct: 23.33,
};

export const formatRupees = (n) =>
  n == null ? '–' : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;
