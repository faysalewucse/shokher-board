const express = require('express');
const healthRoutes       = require('./healthRoutes');
const authRoutes         = require('./authRoutes');
const userRoutes         = require('./userRoutes');
const roleRoutes         = require('./roleRoutes');
const permissionRoutes   = require('./permissionRoutes');
const configRoutes       = require('./configRoutes');
const notificationRoutes = require('./notificationRoutes');
const auditRoutes        = require('./auditRoutes');
const adminRoutes        = require('./adminRoutes');
const clientRoutes       = require('./clientRoutes');
const projectRoutes      = require('./projectRoutes');
const boardRoutes        = require('./boardRoutes');
const listRoutes         = require('./listRoutes');
const cardRoutes         = require('./cardRoutes');
const labelRoutes        = require('./labelRoutes');
const commentRoutes      = require('./commentRoutes');
const attachmentRoutes   = require('./attachmentRoutes');
const { checklistRouter, itemRouter } = require('./checklistRoutes');
const integrationRoutes = require('./integrationRoutes');

const router = express.Router();

router.use('/health',        healthRoutes);
router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/roles',         roleRoutes);
router.use('/permissions',   permissionRoutes);
router.use('/config',        configRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit-logs',    auditRoutes);
router.use('/admin',         adminRoutes);

// Boards domain (see docs/boards-contract.md)
router.use('/clients',         clientRoutes);
router.use('/projects',        projectRoutes);
router.use('/boards',          boardRoutes);
router.use('/lists',           listRoutes);
router.use('/cards',           cardRoutes);
router.use('/labels',          labelRoutes);
router.use('/checklists',      checklistRouter);
router.use('/checklist-items', itemRouter);
router.use('/comments',        commentRoutes);
router.use('/attachments',     attachmentRoutes);
router.use('/integrations', integrationRoutes);

module.exports = router;
