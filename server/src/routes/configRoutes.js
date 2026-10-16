const express = require('express');
const { getConfig, getPublicConfig, updateConfig } = require('../controllers/configController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const configValidation = require('../validations/configValidation');

const router = express.Router();

router.get('/public', getPublicConfig); // no auth — for public clients
router.get('/',       authenticate, authorize('SETTINGS_READ'),   getConfig);
router.patch('/',     authenticate, authorize('SETTINGS_UPDATE'), validate(configValidation.updateConfig), updateConfig);

module.exports = router;
