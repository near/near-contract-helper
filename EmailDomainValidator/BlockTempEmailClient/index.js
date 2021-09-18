const BlockTempEmailClient = require('./BlockTempEmailClient');

const { BLOCK_TEMP_EMAIL_API_KEY } = process.env;

const validator = new BlockTempEmailClient({ API_KEY: BLOCK_TEMP_EMAIL_API_KEY });

module.exports = validator;