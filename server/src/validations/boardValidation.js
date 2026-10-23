const Joi = require('joi');

const BOARD_ROLES = ['owner', 'member', 'viewer'];
const color = Joi.string().max(30).trim();

// ── Trello import (normalized payload, see docs/trello-import.md) ──
const tStr = (max) => Joi.string().max(max).allow('', null);
const tId = Joi.string().max(64).required();
const tIds = Joi.array().items(Joi.string().max(64)).max(500).default([]);
const tDate = Joi.alternatives().try(Joi.date().iso(), Joi.string().valid('')).allow(null);
const tMember = Joi.object({ id: Joi.string().max(64).required(), fullName: tStr(200), username: tStr(200) });

const trelloData = Joi.object({
  board: Joi.object({ name: tStr(16384), desc: tStr(20000) }).default({}),
  lists: Joi.array().max(1000).items(Joi.object({
    id: tId, name: tStr(16384), pos: Joi.number().allow(null), closed: Joi.boolean().default(false),
  })).required(),
  labels: Joi.array().max(1000).items(Joi.object({ id: tId, name: tStr(16384), color: tStr(30) })).default([]),
  members: Joi.array().max(2000).items(tMember).default([]),
  cards: Joi.array().max(5000).items(Joi.object({
    id: tId,
    idList: Joi.string().max(64).required(),
    name: tStr(16384),
    desc: tStr(20000),
    pos: Joi.number().allow(null),
    closed: Joi.boolean().default(false),
    due: tDate,
    start: tDate,
    dueComplete: Joi.boolean().default(false),
    idLabels: tIds,
    idMembers: tIds,
    idChecklists: tIds,
    attachments: Joi.array().max(200).items(Joi.object({
      name: tStr(2000), url: tStr(4000), bytes: Joi.number().min(0).allow(null), mimeType: tStr(255), date: tDate,
    })).default([]),
  })).required(),
  checklists: Joi.array().max(20000).items(Joi.object({
    id: tId,
    idCard: Joi.string().max(64).required(),
    name: tStr(16384),
    pos: Joi.number().allow(null),
    checkItems: Joi.array().max(500).items(Joi.object({
      name: tStr(16384),
      state: Joi.string().valid('complete', 'incomplete').default('incomplete'),
      pos: Joi.number().allow(null),
      due: tDate,
      idMember: Joi.string().max(64).allow('', null),
    })).default([]),
  })).default([]),
  comments: Joi.array().max(20000).items(Joi.object({
    idCard: Joi.string().max(64).required(),
    text: tStr(16384),
    date: tDate,
    memberCreator: tMember.allow(null),
  })).default([]),
}).required();

module.exports = {
  createBoard: Joi.object({
    name:        Joi.string().min(1).max(200).trim().required(),
    description: Joi.string().max(20000).allow('', null).optional(),
    color:       color.allow('', null).optional(),
    projectId:   Joi.string().max(191).allow(null, '').optional(),
  }),

  updateBoard: Joi.object({
    name:        Joi.string().min(1).max(200).trim().optional(),
    description: Joi.string().max(20000).allow('', null).optional(),
    color:       color.allow('', null).optional(),
    projectId:   Joi.string().max(191).allow(null).optional(),
  }).min(1),

  addMember: Joi.object({
    userId: Joi.string().max(191).required(),
    role:   Joi.string().valid(...BOARD_ROLES).default('member'),
  }),

  updateMember: Joi.object({
    role: Joi.string().valid(...BOARD_ROLES).required(),
  }),

  createLabel: Joi.object({
    name:  Joi.string().min(1).max(100).trim().required(),
    color: color.default('blue'),
  }),

  updateLabel: Joi.object({
    name:  Joi.string().min(1).max(100).trim().optional(),
    color: color.optional(),
  }).min(1),

  createList: Joi.object({
    name:     Joi.string().min(1).max(200).trim().required(),
    position: Joi.number().optional(),
  }),

  updateList: Joi.object({
    name:     Joi.string().min(1).max(200).trim().optional(),
    position: Joi.number().optional(),
  }).min(1),

  importTrello: Joi.object({
    name:            Joi.string().min(1).max(200).trim().required(),
    projectId:       Joi.string().max(191).allow(null, '').optional(),
    includeArchived: Joi.boolean().default(false),
    memberMap:       Joi.object().pattern(Joi.string().max(64), Joi.string().max(191).allow(null, '')).max(2000).default({}),
    data:            trelloData,
  }),

  createMessage: Joi.object({
    text:   Joi.string().min(1).max(20000).trim().required(),
    listId: Joi.string().max(191).allow(null, '').optional(),
  }),
};
