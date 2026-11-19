const { z } = require('zod');

function requestSchema(body, params, query) {
  return z.object({
    body: body || z.object({}).strict(),
    query: query || z.object({}).passthrough(),
    params: params || z.object({}).passthrough(),
  });
}

const uuidParam = (name = 'id') => z.object({ [name]: z.string().uuid() });

module.exports = { requestSchema, uuidParam };
