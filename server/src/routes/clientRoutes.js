const express = require('express');
const { listClients, getClient, createClient, updateClient, archiveClient } = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const clientValidation = require('../validations/clientValidation');

const router = express.Router();

router.get('/',       authenticate, authorize('CLIENT_READ'),   listClients);
router.get('/:id',    authenticate, authorize('CLIENT_READ'),   getClient);
router.post('/',      authenticate, authorize('CLIENT_MANAGE'), validate(clientValidation.createClient), createClient);
router.patch('/:id',  authenticate, authorize('CLIENT_MANAGE'), validate(clientValidation.updateClient), updateClient);
router.delete('/:id', authenticate, authorize('CLIENT_MANAGE'), archiveClient);

module.exports = router;
