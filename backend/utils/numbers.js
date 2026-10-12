// Blank becomes null (not undefined, which $set would skip), so clearing a
// previously saved number actually clears it.
const toNumberOrNull = (v) => (v === '' || v == null ? null : Number(v));

const round = (value, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

module.exports = { toNumberOrNull, round };
