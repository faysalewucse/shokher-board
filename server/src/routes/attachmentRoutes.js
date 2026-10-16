const express = require('express');
const { deleteAttachment } = require('../controllers/attachmentController');
const { authenticate } = require('../middleware/auth');
const { assertBoardRole } = require('../services/boardAccess');

const router = express.Router();

router.delete('/:id', authenticate, assertBoardRole('member', 'attachment'), deleteAttachment);

module.exports = router;
