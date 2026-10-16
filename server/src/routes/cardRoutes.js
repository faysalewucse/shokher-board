const express = require('express');
const c = require('../controllers/cardController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadAttachment } = require('../middleware/upload');
const { assertBoardRole } = require('../services/boardAccess');
const v = require('../validations/cardValidation');

const router = express.Router();

const viewer = assertBoardRole('viewer', 'card');
const member = assertBoardRole('member', 'card');

router.get('/:id',          authenticate, viewer, c.getCard);
router.patch('/:id',        authenticate, member, validate(v.updateCard), c.updateCard);
router.patch('/:id/move',   authenticate, member, validate(v.moveCard), c.moveCard);
router.delete('/:id',       authenticate, member, c.archiveCard);
router.put('/:id/assignees', authenticate, member, validate(v.setAssignees), c.setAssignees);
router.put('/:id/labels',   authenticate, member, validate(v.setLabels), c.setLabels);
router.get('/:id/activity', authenticate, viewer, c.listActivity);

router.post('/:id/checklists', authenticate, member, validate(v.createChecklist), c.createChecklist);

router.get('/:id/comments',  authenticate, viewer, c.listComments);
router.post('/:id/comments', authenticate, member, validate(v.createComment), c.createComment);

// Access is checked before multer runs so rejected requests never write to disk.
router.post('/:id/attachments', authenticate, member, uploadAttachment('file'), c.addAttachment);

module.exports = router;
