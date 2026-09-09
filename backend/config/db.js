const mongoose = require('mongoose');

// Connects mongoose's default connection to the central control DB
// (users, projects — the registry, not per-project data).
async function connectCentralDb() {
  const uri = `${process.env.MONGO_URI_BASE}/${process.env.MONGO_CENTRAL_DB}?retryWrites=true&w=majority`;

  mongoose.connection.on('connected', () => {
    console.log(`[db] central connection ready (${process.env.MONGO_CENTRAL_DB})`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] central connection error:', err.message);
  });

  await mongoose.connect(uri);
}

module.exports = connectCentralDb;
