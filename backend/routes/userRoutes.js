const express = require('express');
const auth = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { listUsers, createUser, updateUser, setAssignments } = require('../controllers/userController');

const router = express.Router();

// Every route here manages *other* users' accounts/access, so all of it is
// superadmin-only.
router.use(auth, requireSuperAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/assignments', setAssignments);

module.exports = router;
