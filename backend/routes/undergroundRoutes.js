const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const requireProjectAccess = require('../middleware/requireProjectAccess');
const checkAssignment = require('../middleware/checkAssignment');
const levelController = require('../controllers/levelController');
const supervisorController = require('../controllers/supervisorController');
const workerController = require('../controllers/workerController');
const { listHeadings, createHeading, updateHeading } = require('../controllers/headingController');
const { listUgProduction, upsertUgProduction, deleteUgProduction } = require('../controllers/ugProductionController');
const { listUgDevelopment, upsertUgDevelopment, deleteUgDevelopment } = require('../controllers/ugDevelopmentController');

// Master lists follow the same rule as vehicles and drivers: anyone on the
// project can read the list and add to it inline while filling a form;
// renaming or deactivating is superadmin-only.
function masterRouter({ list, create, update }) {
  const router = express.Router({ mergeParams: true });
  router.get('/', requireProjectAccess, list);
  router.post('/', requireProjectAccess, create);
  router.patch('/:id', requireSuperAdmin, update);
  return router;
}

// Entry routes are gated by the form's own assignment.
function entryRouter(formSlug, { list, upsert, remove }) {
  const router = express.Router({ mergeParams: true });
  router.use(checkAssignment(formSlug));
  router.get('/', list);
  router.post('/', upsert);
  router.delete('/:entryId', remove);
  return router;
}

module.exports = {
  levelRoutes: masterRouter(levelController),
  supervisorRoutes: masterRouter(supervisorController),
  workerRoutes: masterRouter(workerController),
  headingRoutes: masterRouter({ list: listHeadings, create: createHeading, update: updateHeading }),
  ugProductionRoutes: entryRouter('ug-production', {
    list: listUgProduction,
    upsert: upsertUgProduction,
    remove: deleteUgProduction,
  }),
  ugDevelopmentRoutes: entryRouter('ug-development', {
    list: listUgDevelopment,
    upsert: upsertUgDevelopment,
    remove: deleteUgDevelopment,
  }),
};
