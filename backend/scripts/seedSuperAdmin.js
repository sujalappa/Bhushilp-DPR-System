// One-time bootstrap: creates the first superadmin account. Every other user
// (including further superadmins) is created afterwards through
// POST /api/users, which is itself superadmin-gated — this script exists
// only to break that chicken-and-egg problem on a fresh database.
//
// Usage: node scripts/seedSuperAdmin.js "Full Name" email@example.com password123

require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectCentralDb = require('../config/db');
const User = require('../models/central/User');

async function main() {
  const [, , name, email, password] = process.argv;
  if (!name || !email || !password) {
    console.error('Usage: node scripts/seedSuperAdmin.js "<name>" <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  await connectCentralDb();

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    console.log(`A user with email ${normalizedEmail} already exists (id: ${existing._id}). Nothing to do.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: normalizedEmail, passwordHash, isSuperAdmin: true });
  console.log(`Created superadmin "${user.name}" <${user.email}> (id: ${user._id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed superadmin:', err);
  process.exit(1);
});
