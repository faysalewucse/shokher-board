const express = require('express');
const { updateComment, deleteComment } = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertBoardRole } = require('../services/boardAccess');
const cardValidation = require('../validations/cardValidation');

const router = express.Router();

// Author-only / author-or-owner rules are enforced in commentService.
router.patch('/:id',  authenticate, assertBoardRole('member', 'comment'), validate(cardValidation.updateComment), updateComment);
router.delete('/:id', authenticate, assertBoardRole('member', 'comment'), deleteComment);

module.exports = router;
