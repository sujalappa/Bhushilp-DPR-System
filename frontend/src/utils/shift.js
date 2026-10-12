// "Shift II" for the numbered shifts, "General shift" for the general one.
export const shiftLabel = (shift) => (shift === 'General' ? 'General shift' : `Shift ${shift}`);

// "1 entry", "3 entries".
export const entryCount = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
