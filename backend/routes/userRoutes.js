const express = require('express');
const auth = require('../middleware/auth');
const requireManager = require('../middleware/requireManager');
const { listUsers, createUser, updateUser, setAssignments } = require('../controllers/userController');

const router = express.Router();

// Every route here manages other users' accounts and access: the superadmin
// for everyone, an admin for the supervisors of their own projects (the
// controller enforces which).
router.use(auth, requireManager);

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/assignments', setAssignments);

module.exports = router;
