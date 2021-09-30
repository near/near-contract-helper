require('dotenv').config({ path: 'test/.env.test' });

const sinon = require('sinon');

const { logSmsSend } = require('../../middleware/logger');
const chai = require('../chai');

const { expect } = chai;
const mockContext = {
    request: {
        body: {
            kind: 'phone',
            identityKey: '+1234567890',
            method: {
                kind: 'phone',
                detail: '+1234567890',
            },
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

    describe('logSmsSend', () => {
        it('calls next() for well-formed request', () => {
            logSmsSend(mockContext, nextMock);
            expect(nextMock.calledOnce).true;
        });

        it('calls next() for empty request', () => {
            logSmsSend({ request: { body: {} }}, nextMock);
            expect(nextMock.calledOnce).true;
        });
    });
});
