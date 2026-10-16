const express = require('express');
const c = require('../controllers/checklistController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertBoardRole } = require('../services/boardAccess');
const v = require('../validations/cardValidation');

// Mounted at /checklists
const checklistRouter = express.Router();
const checklistMember = assertBoardRole('member', 'checklist');

checklistRouter.patch('/:id',      authenticate, checklistMember, validate(v.updateChecklist), c.updateChecklist);
checklistRouter.delete('/:id',     authenticate, checklistMember, c.deleteChecklist);
checklistRouter.post('/:id/items', authenticate, checklistMember, validate(v.createChecklistItem), c.createItem);

// Mounted at /checklist-items
const itemRouter = express.Router();
const itemMember = assertBoardRole('member', 'checklistItem');

itemRouter.patch('/:id',  authenticate, itemMember, validate(v.updateChecklistItem), c.updateItem);
itemRouter.delete('/:id', authenticate, itemMember, c.deleteItem);

module.exports = { checklistRouter, itemRouter };
