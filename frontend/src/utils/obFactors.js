// The kinds of handling a Shift Card entry can be marked as, and the m³ of
// overburden each trip is credited with. Must match backend/utils/obFactors
// — the server does the real calculation; this is only for showing the
// figure while the card is being filled in.
export const HANDLING_TYPES = [
  { value: 'ob-rehandling', label: 'OB Rehandling', perTrip: 14 },
  // Placeholder until the site confirms the Soft OB figure.
  { value: 'soft-ob', label: 'Soft OB', perTrip: 14 },
];

export const handlingOf = (value) => HANDLING_TYPES.find((h) => h.value === value) || HANDLING_TYPES[0];
