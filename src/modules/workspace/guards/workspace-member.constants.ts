import Joi from 'joi';

/**
 * UUID-v4 schema for workspace route params.
 * Rejects malformed `:workspaceId` values before any database lookup.
 */
export const UUID_V4_SCHEMA = Joi.string()
  .uuid({ version: 'uuidv4' })
  .required();
