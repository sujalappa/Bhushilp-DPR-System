const express = require('express');
const { listTrips, addTrip, updateTrip, deleteTrip } = require('../controllers/tripController');

// mergeParams: true — mounted at /api/projects/:projectId/shift-logs/:shiftLogId/trips,
// inherits checkAssignment('shift-card') from the parent shiftLogRoutes router.
const router = express.Router({ mergeParams: true });

router.get('/', listTrips);
router.post('/', addTrip);
router.patch('/:tripId', updateTrip);
router.delete('/:tripId', deleteTrip);

module.exports = router;
