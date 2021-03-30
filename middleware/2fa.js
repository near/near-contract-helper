const serviceInstance = require('./2fa_service');

// Use service module to bind middleware
module.exports = {
    getAccessKey: (ctx) => serviceInstance.getAccessKey(ctx),
    initCode: (ctx) => serviceInstance.initCode(ctx),
    sendNewCode: (ctx) => serviceInstance.sendNewCode(ctx),
    verifyCode: (ctx) => serviceInstance.verifyCode(ctx),
};

