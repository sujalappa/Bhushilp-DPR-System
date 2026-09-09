const mongoose = require('mongoose');
const projectSchemas = require('../models/project');

// One Mongoose connection per project database, cached by dbName so repeat
// requests for the same project reuse the connection instead of reopening it.
// Each connection gets its own compiled set of models, since a Schema can't
// be attached to more than one connection at a time.
const cache = new Map(); // dbName -> { connection, models }

async function getProjectConnection(dbName) {
  if (cache.has(dbName)) {
    return cache.get(dbName);
  }

  const uri = `${process.env.MONGO_URI_BASE}/${dbName}?retryWrites=true&w=majority`;
  const connection = mongoose.createConnection(uri);
  await connection.asPromise();

  const models = {};
  for (const [name, schema] of Object.entries(projectSchemas)) {
    models[name] = connection.model(name, schema);
  }

  const entry = { connection, models };
  cache.set(dbName, entry);

  connection.on('error', (err) => {
    console.error(`[projectDb] connection error for ${dbName}:`, err.message);
  });

  return entry;
}

module.exports = { getProjectConnection };
