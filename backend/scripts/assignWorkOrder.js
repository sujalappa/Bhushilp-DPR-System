// One-off fix for an underground project that has entries saved before work
// orders existed: puts them all under one work order (created if it doesn't
// exist yet) and drops the old uniqueness rules that didn't include the
// work order, which would otherwise stop the same gang being entered under
// two work orders on the same shift.
//
// Usage: node scripts/assignWorkOrder.js "<project name>" <work order number>
// e.g.   node scripts/assignWorkOrder.js "Moil Chikhla" 9100005472
//
// Safe to run twice: entries that already have a work order are left alone.

require('dotenv').config();
const mongoose = require('mongoose');
const connectCentralDb = require('../config/db');
const Project = require('../models/central/Project');
const { getProjectConnection } = require('../config/projectDb');

const OLD_INDEXES = {
  ugproductions: 'date_1_shift_1_levelId_1_supervisorId_1',
  ugdevelopments: 'date_1_shift_1_headingId_1',
};

async function main() {
  const [, , projectName, number] = process.argv;
  if (!projectName || !number) {
    console.error('Usage: node scripts/assignWorkOrder.js "<project name>" <work order number>');
    process.exit(1);
  }

  await connectCentralDb();
  const project = await Project.findOne({ name: projectName, type: 'underground' });
  if (!project) {
    console.error(`No underground project named "${projectName}"`);
    process.exit(1);
  }

  const { connection, models } = await getProjectConnection(project.dbName);
  let workOrder = await models.WorkOrder.findOne({ number });
  if (!workOrder) {
    workOrder = await models.WorkOrder.create({ number });
    console.log(`Created work order ${number} with the default rates — check them on its page.`);
  }

  for (const [collection, indexName] of Object.entries(OLD_INDEXES)) {
    const indexes = await connection.db.collection(collection).indexes().catch(() => []);
    if (indexes.some((i) => i.name === indexName)) {
      await connection.db.collection(collection).dropIndex(indexName);
      console.log(`Dropped old index ${indexName} on ${collection}`);
    }
  }

  const missing = { workOrderId: { $exists: false } };
  const production = await models.UgProduction.updateMany(missing, { $set: { workOrderId: workOrder._id } });
  const development = await models.UgDevelopment.updateMany(missing, { $set: { workOrderId: workOrder._id } });
  await Promise.all([models.UgProduction.syncIndexes(), models.UgDevelopment.syncIndexes()]);

  console.log(
    `Moved ${production.modifiedCount} Level Production and ${development.modifiedCount} Development entries under work order ${number}.`
  );
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
