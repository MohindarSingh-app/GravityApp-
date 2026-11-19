const { sendSuccess } = require('../../utils/energy_service/response');

function overview(_req, res) {
  sendSuccess(res, { message: 'Admin access granted.' });
}

module.exports = { overview };
