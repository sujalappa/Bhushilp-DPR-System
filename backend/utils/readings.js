const AppError = require('./AppError');

// A meter reading can't go backwards: closing KM / hours must be at least
// the opening reading. Only checked when both are filled in.
function assertNotBelow(opening, closing, what) {
  const blank = (v) => v === '' || v == null;
  if (blank(opening) || blank(closing)) return;
  if (Number(closing) < Number(opening)) {
    throw new AppError(`Closing ${what} can't be less than opening ${what}`, 400);
  }
}

module.exports = { assertNotBelow };
