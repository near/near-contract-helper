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
        const initServiceWithFailedVerification = (error) => {
            const createVerificationCheck = sinon.stub().rejects(error);
            const twilio = createTwilioClientMock({ createVerificationCheck });

            return new TwilioVerifyService({
                twilio,
            });
        };

        it('non-existant verification', async () => {
            const error = new Error();
            error.code = 20404;

            const twilioVerifyService = initServiceWithFailedVerification(error);

            error.response = {
                status: 429,
                text: '2FA request expired, please try again',
            };

            return expect(twilioVerifyService.verify({}))
                .rejectedWith(error);
        });

        it('service rate limit reached', async () => {
            const error = new Error();
            error.code = 20429;

            const twilioVerifyService = initServiceWithFailedVerification(error);

            error.response = {
                status: 429,
                text: '2FA rate limit for phone number reached, please try again later',
            };

            return expect(twilioVerifyService.verify({}))
                .rejectedWith(error);
        });

        it('verification check limit reached', async () => {
            const error = new Error();
            error.code = 60202;

            const twilioVerifyService = initServiceWithFailedVerification(error);

            error.response = {
                status: 429,
                text: '2FA verification check limit reached, please try again later',
            };

            return expect(twilioVerifyService.verify({}))
                .rejectedWith(error);
        });

        it('verification delivery limit reached', async () => {
            const error = new Error();
            error.code = 60203;

            const twilioVerifyService = initServiceWithFailedVerification(error);

            error.response = {
                status: 429,
                text: '2FA delivery limit reached, please try again later',
            };

            return expect(twilioVerifyService.verify({}))
                .rejectedWith(error);
        });

        it('unknown', async () => {
            const error = new Error();
            error.code = 10000;

            const twilioVerifyService = initServiceWithFailedVerification(error);

            error.response = {
                status: 500,
                text: 'Twilio Verify Error',
            };

            return expect(twilioVerifyService.verify({}))
                .rejectedWith(error);
        });
    });
});
