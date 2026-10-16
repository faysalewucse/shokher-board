const express = require('express');
const { getAllRoles, getRoleById, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const roleValidation = require('../validations/roleValidation');

const router = express.Router();

router.get('/',    authenticate, authorize('ROLE_READ'),   getAllRoles);
router.get('/:id', authenticate, authorize('ROLE_READ'),   getRoleById);
router.post('/',   authenticate, authorize('ROLE_CREATE'), validate(roleValidation.createRole), createRole);
router.patch('/:id', authenticate, authorize('ROLE_UPDATE'), validate(roleValidation.updateRole), updateRole);
router.delete('/:id', authenticate, authorize('ROLE_DELETE'), deleteRole);

module.exports = router;
