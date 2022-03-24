const sinon = require('sinon');

const chai = require('../chai');
const TwilioVerifyService = require('../../services/twilio_verify/twilio_verify');

const { expect } = chai;

const createTwilioClientMock = ({ createVerification, createVerificationCheck }) => () => ({
    verify: {
        services() {
            return {
                verifications: {
                    create: createVerification,
                },
                verificationChecks: {
                    create: createVerificationCheck,
                }
            };
        }
    }
});

describe('TwilioVerifyService', () => {
    describe('verifications', () => {
        const to = 'phone number';
        const code = '123456';

        it('creates a verification', async () => {
            const createVerification = sinon.stub().resolves();
            const twilio = createTwilioClientMock({ createVerification });
            const twilioVerifyService = new TwilioVerifyService({
                twilio,
            });

            await twilioVerifyService.send({ to });

            expect(createVerification).calledOnceWith({ to, channel: 'sms' });
        });

        describe('verifies the provided code', () => {
            it('when valid', async () => {
                const createVerificationCheck = sinon.stub().resolves({ valid: true });
                const twilio = createTwilioClientMock({ createVerificationCheck });
                const twilioVerifyService = new TwilioVerifyService({
                    twilio,
                });

                const verify = await twilioVerifyService.verify({ to, code });

                expect(verify).true;
                expect(createVerificationCheck).calledOnceWith({ to, code });
            });

            it('when invalid', async () => {
                const createVerificationCheck = sinon.stub().resolves({ valid: false });
                const twilio = createTwilioClientMock({ createVerificationCheck });
                const twilioVerifyService = new TwilioVerifyService({
                    twilio,
                });

                const verify = await twilioVerifyService.verify({ to, code });

                expect(verify).false;
                expect(createVerificationCheck).calledOnceWith({ to, code });
            });
        });
    });

    describe('handles twilio errors', () => {
        const initServiceWithFailedVerification = (code) => {
            const error = new Error();
            error.code = code;

            const createVerificationCheck = sinon.stub().rejects(error);
            const twilio = createTwilioClientMock({ createVerificationCheck });

            return new TwilioVerifyService({
                twilio,
            });
        };

        it('non-existant verification', async () => {
            const twilioVerifyService = initServiceWithFailedVerification(20404);

            twilioVerifyService.verify({}).catch((error) => {
                expect(error.response).eq({
                    status: 429,
                    text: '2FA request expired, please try again',
                });
            });
        });

        it('service rate limit reached', async () => {
            const twilioVerifyService = initServiceWithFailedVerification(20429);

            twilioVerifyService.verify({}).catch((error) => {
                expect(error.response).eq({
                    status: 429,
                    text: '2FA rate limit reached, please try again later',
                });
            });
        });

        it('verification check limit reached', async () => {
            const twilioVerifyService = initServiceWithFailedVerification(20429);

            twilioVerifyService.verify({}).catch((error) => {
                expect(error.response).eq({
                    status: 429,
                    text: '2FA verification check limit reached, please try again later',
                });
            });
        });

        it('verification delivery limit reached', async () => {
            const twilioVerifyService = initServiceWithFailedVerification(20429);

            twilioVerifyService.verify({}).catch((error) => {
                expect(error.response).eq({
                    status: 429,
                    text: '2FA delivery limit reached, please try again later',
                });
            });
        });

        it('unknown', async () => {
            const twilioVerifyService = initServiceWithFailedVerification(20429);

            twilioVerifyService.verify({}).catch((error) => {
                expect(error.response).eq({
                    status: 500,
                    text: 'Twilio Verify Error',
                });
            });
        });
    });
});
