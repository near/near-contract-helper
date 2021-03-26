const legacyModule = require('./2fa.legacy');
const serviceInstance = require('./2fa_service');

if(!process.env.USE_2FA_SERVICE) {
    // Export original middleware bindings
    module.exports = legacyModule;
} else {
    // Use service module to bind middleware
    module.exports = {
        getAccessKey: (ctx) => serviceInstance.getAccessKey(ctx),
        initCode: (ctx) => serviceInstance.initCode(ctx),
        sendNewCode: (ctx) => serviceInstance.sendNewCode(ctx),
        verifyCode: (ctx) => serviceInstance.verifyCode(ctx),
    };
}

