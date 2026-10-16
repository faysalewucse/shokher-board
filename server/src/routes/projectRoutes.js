const express = require('express');
const { listProjects, getProject, createProject, updateProject, archiveProject } = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const projectValidation = require('../validations/projectValidation');

const router = express.Router();

router.get('/',       authenticate, authorize('PROJECT_READ'),   listProjects);
router.get('/:id',    authenticate, authorize('PROJECT_READ'),   getProject);
router.post('/',      authenticate, authorize('PROJECT_MANAGE'), validate(projectValidation.createProject), createProject);
router.patch('/:id',  authenticate, authorize('PROJECT_MANAGE'), validate(projectValidation.updateProject), updateProject);
router.delete('/:id', authenticate, authorize('PROJECT_MANAGE'), archiveProject);

module.exports = router;
