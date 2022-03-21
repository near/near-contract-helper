const password = require('secure-random-password');

module.exports = class TwilioVerifyMock {
    securityCodes = {};

    send({ to }, emit) {
        const securityCode = password.randomPassword({ length: 6, characters: password.digits });
        this.securityCodes[to] = securityCode;
        emit(securityCode);
    }

    async verify({ to, code }) {
        if (code !== this.securityCodes[to]) {
            return { valid: false };
        }

        return { valid: true };
    }
};
