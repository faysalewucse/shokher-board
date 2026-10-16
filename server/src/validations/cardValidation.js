const Joi = require('joi');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const id = Joi.string().max(191);

module.exports = {
  createCard: Joi.object({
    listId:      id.required(),
    title:       Joi.string().min(1).max(500).trim().required(),
    description: Joi.string().max(50000).allow('', null).optional(),
    position:    Joi.number().optional(),
    dueDate:     Joi.date().allow(null).optional(),
    startDate:   Joi.date().allow(null).optional(),
    priority:    Joi.string().valid(...PRIORITIES).allow(null).optional(),
    assigneeIds: Joi.array().items(id).max(50).default([]),
    labelIds:    Joi.array().items(id).max(50).default([]),
  }),

  updateCard: Joi.object({
    title:       Joi.string().min(1).max(500).trim().optional(),
    description: Joi.string().max(50000).allow('', null).optional(),
    dueDate:     Joi.date().allow(null).optional(),
    startDate:   Joi.date().allow(null).optional(),
    priority:    Joi.string().valid(...PRIORITIES).allow(null).optional(),
    completed:   Joi.boolean().optional(),
  }).min(1),

  moveCard: Joi.object({
    listId:   id.required(),
    position: Joi.number().required(),
  }),

  setAssignees: Joi.object({
    userIds: Joi.array().items(id).max(50).required(),
  }),

  setLabels: Joi.object({
    labelIds: Joi.array().items(id).max(50).required(),
  }),

  createChecklist: Joi.object({
    title: Joi.string().min(1).max(200).trim().required(),
  }),

  updateChecklist: Joi.object({
    title:    Joi.string().min(1).max(200).trim().optional(),
    position: Joi.number().optional(),
  }).min(1),

  createChecklistItem: Joi.object({
    text: Joi.string().min(1).max(1000).trim().required(),
  }),

  updateChecklistItem: Joi.object({
    text:       Joi.string().min(1).max(1000).trim().optional(),
    isDone:     Joi.boolean().optional(),
    position:   Joi.number().optional(),
    assigneeId: id.allow(null).optional(),
    dueDate:    Joi.date().allow(null).optional(),
  }).min(1),

  createComment: Joi.object({
    body: Joi.string().min(1).max(20000).trim().required(),
  }),

  updateComment: Joi.object({
    body: Joi.string().min(1).max(20000).trim().required(),
  }),
};
