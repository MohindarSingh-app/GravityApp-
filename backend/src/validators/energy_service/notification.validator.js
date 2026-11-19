const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');

const notificationIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

module.exports = { notificationIdSchema };
