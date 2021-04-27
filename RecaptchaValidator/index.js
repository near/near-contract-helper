const { RecaptchaValidator } = require('./RecaptchaValidator');

const { RECAPTCHA_SECRET } = process.env;

module.exports = new RecaptchaValidator({ RECAPTCHA_SECRET });
