const express = require('express');
const c = require('../controllers/boardController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertBoardRole } = require('../services/boardAccess');
const v = require('../validations/boardValidation');
const cardValidation = require('../validations/cardValidation');

const router = express.Router();

const viewer = assertBoardRole('viewer');
const member = assertBoardRole('member');
const owner  = assertBoardRole('owner');

// Boards
router.get('/',       authenticate, c.listBoards);
router.post('/',      authenticate, authorize('BOARD_CREATE'), validate(v.createBoard), c.createBoard);
router.post('/import/trello', authenticate, authorize('BOARD_CREATE'), validate(v.importTrello), c.importTrello);
router.get('/:id',    authenticate, viewer, c.getBoard);
router.patch('/:id',  authenticate, owner,  validate(v.updateBoard), c.updateBoard);
router.delete('/:id', authenticate, owner,  c.archiveBoard);

// Members (owner only)
router.post('/:id/members',           authenticate, owner, validate(v.addMember),    c.addMember);
router.patch('/:id/members/:userId',  authenticate, owner, validate(v.updateMember), c.updateMember);
router.delete('/:id/members/:userId', authenticate, owner, c.removeMember);

// Labels (owner only); PATCH/DELETE live under /labels/:id
router.post('/:id/labels', authenticate, owner, validate(v.createLabel), c.createLabel);

// Activity feed
router.get('/:id/activity', authenticate, viewer, c.listActivity);

// Lists & cards (members)
router.post('/:id/lists', authenticate, member, validate(v.createList), c.createList);
router.post('/:id/cards', authenticate, member, validate(cardValidation.createCard), c.createCard);

// Message-to-card bar
router.get('/:id/messages',  authenticate, viewer, c.listMessages);
router.post('/:id/messages', authenticate, member, validate(v.createMessage), c.createMessage);

module.exports = router;
