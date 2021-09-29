require('dotenv').config({ path: 'test/.env.test' });

const sinon = require('sinon');

const { logIdentityRequest } = require('../../middleware/logger');
const chai = require('../chai');

const { expect } = chai;
const mockContext = {
    request: {
        body: {
            kind: 'sms',
            identityKey: '+1234567890',
        },
        ip: '127.0.0.1',
        method: 'POST',
        path: '/account/initializeRecoveryMethod',
    },
};

describe('logger middleware', function () {
    const nextMock = sinon.mock();
    afterEach(function () {
        nextMock.resetHistory();
    });

    describe('logIdentityRequest', () => {
        it('calls next() for well-formed request', () => {
            logIdentityRequest(mockContext, nextMock);
            expect(nextMock.calledOnce).true;
        });

        it('still calls next() for unexpected request', () => {
            logIdentityRequest(undefined, nextMock);
            expect(nextMock.calledOnce).true;
        });
    });
});