const express = require('express');
const { updateLabel, deleteLabel } = require('../controllers/labelController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertBoardRole } = require('../services/boardAccess');
const boardValidation = require('../validations/boardValidation');

const router = express.Router();

router.patch('/:id',  authenticate, assertBoardRole('owner', 'label'), validate(boardValidation.updateLabel), updateLabel);
router.delete('/:id', authenticate, assertBoardRole('owner', 'label'), deleteLabel);

module.exports = router;
