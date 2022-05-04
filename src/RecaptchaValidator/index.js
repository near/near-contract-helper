const path = require('path');

const { RecaptchaValidator } = require('./RecaptchaValidator');

const { RECAPTCHA_SECRET, RECAPTCHA_ENTERPRISE_PROJECT_NUM: PROJECT_NUMBER } = process.env;

module.exports = new RecaptchaValidator(
    {
        RECAPTCHA_SECRET,
        RECAPTCHA_ENTERPRISE_KEYFILENAME: path.join(__dirname, '../recaptcha_enterprise.json'),
        PROJECT_NUMBER
    });
