const sinon = require('sinon');
const nock = require('nock');

const {
    RecaptchaValidator,
    ERROR_MESSAGES,
    GOOGLE_RECAPTCHA_SERVICE_HOST,
    GOOGLE_RECAPTCHA_SERVICE_PATH
} = require('../RecaptchaValidator/RecaptchaValidator');

const chai = require('./chai');

const { expect } = chai;

const testCode = '123456';
const testRemoteIp = '127.0.0.1';
const testSecret = 'fake_secret';

describe('RecaptchaValidator', function () {
    afterEach(function () {
        nock.cleanAll();
    });

    describe('golden path', function () {
        function getRecaptchaValidatorWithStubs() {
            const sendStub = sinon.stub().resolves({ success: true });
            const typeStub = sinon.stub().returns({ send: sendStub });
            const retryStub = sinon.stub().returns({ type: typeStub });
            const postStub = sinon.stub().returns({ retry: retryStub });
            const requestStub = { post: postStub };

            const stubs = {
                send: sendStub,
                type: typeStub,
                retry: retryStub,
                post: postStub,
                request: requestStub
            };

            return {
                instance: new RecaptchaValidator({
                    request: requestStub,
                    RECAPTCHA_SECRET: testSecret
                }),
                stubs
            };
        }

        it('should send a request to Google recaptcha with the expected arguments', async function () {
            const expectedPayload = {
                response: testCode,
                remoteip: testRemoteIp,
                secret: testSecret
            };

            const { instance, stubs } = getRecaptchaValidatorWithStubs();
            await instance.validateRecaptchaCode(testCode, testRemoteIp);

            expect(stubs.send).calledOnceWith(sinon.match(expectedPayload));
        });

        it('should configure superagent to retry 3 times', async function () {
            const { instance, stubs } = getRecaptchaValidatorWithStubs();
            await instance.validateRecaptchaCode(testCode, testRemoteIp);

            expect(stubs.retry).calledOnceWith(3);
        });

        it('should configure superagent to post as multipart form data', async function () {
            const { instance, stubs } = getRecaptchaValidatorWithStubs();
            await instance.validateRecaptchaCode(testCode, testRemoteIp);

            expect(stubs.type).calledOnceWith('form');
        });
    });

    describe('error handling', function () {
        describe('return statusCode 503 with appropriate message for transient failures', function () {
            async function validateNetworkFailureResponse(code) {
                nock(GOOGLE_RECAPTCHA_SERVICE_HOST)
                    .post(GOOGLE_RECAPTCHA_SERVICE_PATH)
                    .reply(code)
                    .persist(true); // Ensure the route persists across internal superagent retries

                const instance = new RecaptchaValidator({ RECAPTCHA_SECRET: testSecret });

                const {
                    success,
                    error: {
                        statusCode,
                        message
                    }
                } = await instance.validateRecaptchaCode(testCode, testRemoteIp);

                expect(success).equal(false);
                expect(statusCode).equal(503);
                expect(message).equal(ERROR_MESSAGES.TRANSPORT_ERROR_ENCOUNTERED);
            }

            it('should convert 502 errors to 503', function () {
                return validateNetworkFailureResponse(502);
            });

            it('should keep 503 errors as-is, but return our message content', function () {
                return validateNetworkFailureResponse(503);
            });

            it('should convert 408 errors to 503', function () {
                return validateNetworkFailureResponse(408);
            });

            it('should convert 500 errors to 503', function () {
                return validateNetworkFailureResponse(500);
            });
        });

        it('should return 500 with a generic message when `success` is false but `error-codes` contains unknown code', async function () {
            nock(GOOGLE_RECAPTCHA_SERVICE_HOST)
                .post(GOOGLE_RECAPTCHA_SERVICE_PATH)
                .reply(200, () => {
                    return { success: false, 'error-codes': ['unknown-error-code'] };
                })
                .persist(true); // Ensure the route persists across internal superagent retries

            const instance = new RecaptchaValidator({ RECAPTCHA_SECRET: testSecret });

            const {
                success,
                error: {
                    statusCode,
                    message
                }
            } = await instance.validateRecaptchaCode(testCode, testRemoteIp);

            expect(success).equal(false);
            expect(statusCode).equal(500);
            expect(message).equal(ERROR_MESSAGES.INTERNAL_ERROR_ENCOUNTERED);
        });
    });
});