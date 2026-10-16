const { errorResponse } = require('../utils/responseHandler');

/**
 * Joi validation middleware
 * - Validates req.body against the schema
 * - Replaces req.body with sanitized values (trimmed, lowercased, unknown fields stripped)
 * - Returns 400 with all errors if validation fails
 *
 * @param {import('joi').ObjectSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body ?? {}, {
    abortEarly: false,    // collect all errors, not just the first
    stripUnknown: true,   // remove fields not in schema
    convert: true,        // coerce types (e.g. trim strings)
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));

    return errorResponse(res, {
      statusCode: 400,
      // Surface the first concrete error so the client shows something useful
      // (e.g. "phone is required") rather than a generic "Validation failed".
      message: errors[0]?.message || 'Validation failed',
      errors,
    });
  }

  req.body = value; // sanitized body
  next();
};

module.exports = { validate };
