const superagent = require('superagent');
const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');

const GOOGLE_RECAPTCHA_SERVICE_HOST = 'https://www.google.com';
const GOOGLE_RECAPTCHA_SERVICE_PATH = '/recaptcha/api/siteverify';
const GOOGLE_RECAPTCHA_SERVICE_URL = GOOGLE_RECAPTCHA_SERVICE_HOST + GOOGLE_RECAPTCHA_SERVICE_PATH;

const ERROR_MESSAGES = {
    NO_CODE_PROVIDED: 'No recaptcha code provided. Please try again.',
    INVALID_CODE_PROVIDED: 'Invalid/malformed recaptcha code provided. Please try again.',
    DUPLICATE_OR_EXPIRED_CODE: 'The recaptcha code provided has expired or been previously used. Please try again.',
    TRANSPORT_ERROR_ENCOUNTERED: 'An error was encountered validating your reCaptcha. Please try again.',
    INTERNAL_ERROR_ENCOUNTERED: 'An error was encountered validating your reCaptcha. Please contact #wallet-support.',
};

const GOOGLE_API_ERROR_CODES = {
    NO_CODE_PROVIDED: 'missing-input-response',
    INVALID_CODE_PROVIDED: 'invalid-input-response',
    DUPLICATE_OR_EXPIRED_CODE: 'timeout-or-duplicate',
    MISSING_SECRET: 'missing-input-secret',
    INVALID_SECRET: 'invalid-input-secret',
    BAD_REQUEST: 'bad-request'
};

const ERROR_CODES = {
    ...GOOGLE_API_ERROR_CODES,
    TRANSPORT_ERROR: 'TRANSPORT_ERROR'
};

const RESPONSES_BY_ERROR_CODE = {
    [ERROR_CODES.NO_CODE_PROVIDED]: { message: ERROR_MESSAGES.NO_CODE_PROVIDED, statusCode: 402 },
    [ERROR_CODES.INVALID_CODE_PROVIDED]: { message: ERROR_MESSAGES.INVALID_CODE_PROVIDED, statusCode: 402 },
    [ERROR_CODES.DUPLICATE_OR_EXPIRED_CODE]: { message: ERROR_MESSAGES.DUPLICATE_OR_EXPIRED_CODE, statusCode: 402 },
    [ERROR_CODES.MISSING_SECRET]: { message: ERROR_MESSAGES.INTERNAL_ERROR_ENCOUNTERED, statusCode: 500 },
    [ERROR_CODES.INVALID_SECRET]: { message: ERROR_MESSAGES.INTERNAL_ERROR_ENCOUNTERED, statusCode: 500 },
    [ERROR_CODES.BAD_REQUEST]: { message: ERROR_MESSAGES.INTERNAL_ERROR_ENCOUNTERED, statusCode: 500 },

    [ERROR_CODES.TRANSPORT_ERROR]: { message: ERROR_MESSAGES.TRANSPORT_ERROR_ENCOUNTERED, statusCode: 503 }
};

function getResponseFromErrorCode(errorCode) {
    return RESPONSES_BY_ERROR_CODE[errorCode] || {
        message: ERROR_MESSAGES.INTERNAL_ERROR_ENCOUNTERED,
        statusCode: 500
    };
}

class RecaptchaValidator {
    constructor({
        request = superagent,
        RECAPTCHA_SECRET,
        PROJECT_NUMBER,
        RECAPTCHA_ENTERPRISE_KEYFILENAME
    }) {
        this.request = request;
        this.RECAPTCHA_SECRET = RECAPTCHA_SECRET;
        this.PROJECT_NUMBER = PROJECT_NUMBER;
        this.enterpriseClient = new RecaptchaEnterpriseServiceClient({ keyFilename: RECAPTCHA_ENTERPRISE_KEYFILENAME });
    }

    // assessment should contain event with RESPONSE_TOKEN and RECAPTCHA_SITE_KEY:
    // "{'event': {'token': 'RESPONSE_TOKEN', 'siteKey': 'RECAPTCHA_SITE_KEY'}}"
    async createEnterpriseAssessment(assessment = {}) {
        const formattedParent = this.enterpriseClient.projectPath(this.PROJECT_NUMBER);

        try {
            const [assessmentResult] = await this.enterpriseClient.createAssessment({
                parent: formattedParent,
                assessment: { event: assessment },
            });

            return {
                score: assessmentResult.riskAnalysis && assessmentResult.riskAnalysis.score,
                valid: assessmentResult.tokenProperties.valid
            };
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw new Error('Failed to initialize reCaptcha enterprise due to missing configuration.');
            }
            throw err;
        }
    }

    // Documentation: https://developers.google.com/recaptcha/docs/verify
    async validateRecaptchaCode(recaptchaCode, remoteIp) {
        let success = false, errorCodes = [];

        try {
            ({ body: { success, 'error-codes': errorCodes = [] } } = await this.request
                .post(GOOGLE_RECAPTCHA_SERVICE_URL)
                .retry(3) // Basic retry to handle truly transient issues verifying
                .type('form')
                .send({
                    secret: this.RECAPTCHA_SECRET,
                    response: recaptchaCode,
                    remoteip: remoteIp
                }));
        } catch (e) {
            // Superagent will return rejected promise when transient/network related errors are encountered
            errorCodes.push(ERROR_CODES.TRANSPORT_ERROR);
        }

        // Although `error-codes` is an array, currently, all possible values are mutually exclusive; use the first elem
        const errorCode = errorCodes && errorCodes[0];
        return {
            success,
            error: errorCode && getResponseFromErrorCode(errorCode),
            code: errorCode
        };
    }
}

module.exports = {
    RecaptchaValidator,
    ERROR_MESSAGES,
    GOOGLE_RECAPTCHA_SERVICE_HOST,
    GOOGLE_RECAPTCHA_SERVICE_PATH,
};