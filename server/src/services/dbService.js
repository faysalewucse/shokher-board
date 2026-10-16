const { throwError } = require('../utils/responseHandler');

/**
 * Find a record by ID using a Prisma model delegate.
 * @param {object} model - Prisma model delegate (e.g. prisma.user)
 * @param {string} id
 * @param {object} [options]
 * @param {object} [options.select]
 * @param {object} [options.include]
 * @param {string} [options.errorMessage]
 * @returns {Promise<object>}
 */
const findById = async (model, id, options = {}) => {
  const { select, include, errorMessage } = options;

  const record = await model.findUnique({
    where: { id },
    ...(select  && { select }),
    ...(include && { include }),
  });

  if (!record) {
    throwError(errorMessage || 'Record not found', 404);
  }

  return record;
};

module.exports = { findById };
