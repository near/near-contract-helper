const password = require('secure-random-password');

module.exports = class MockTwilioVerifyService {
    securityCodes = {};

    send({ to }, emitServerEvent) {
        const securityCode = password.randomPassword({ length: 6, characters: password.digits });

        this.securityCodes[to] = securityCode;
        emitServerEvent(securityCode);
    }

    verify({ to, code }) {
        return code === this.securityCodes[to];
    }
};
