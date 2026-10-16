const express = require('express');
const { updateList, archiveList } = require('../controllers/listController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertBoardRole } = require('../services/boardAccess');
const boardValidation = require('../validations/boardValidation');

const router = express.Router();

router.patch('/:id',  authenticate, assertBoardRole('member', 'list'), validate(boardValidation.updateList), updateList);
router.delete('/:id', authenticate, assertBoardRole('member', 'list'), archiveList);

module.exports = router;
