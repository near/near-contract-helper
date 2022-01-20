const SequelizeRecoveryMethods = require('./sequelize/recovery_method');

const TWO_FACTOR_REQUEST_DURATION_MS = 30 * 60000;

const RecoveryMethodService = {
    createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        return SequelizeRecoveryMethods.createRecoveryMethod({
            accountId,
            detail,
            kind,
            publicKey,
            requestId,
            securityCode,
        });
    },

    deleteOtherRecoveryMethods({ accountId, detail }) {
        return SequelizeRecoveryMethods.deleteOtherRecoveryMethods({ accountId, detail });
    },

    deleteRecoveryMethod({ accountId, kind, publicKey }) {
        return SequelizeRecoveryMethods.deleteRecoveryMethod({ accountId, kind, publicKey });
    },

    getTwoFactorRecoveryMethod(accountId) {
        return SequelizeRecoveryMethods.getTwoFactorRecoveryMethod(accountId);
    },

    isTwoFactorRequestExpired({ updatedAt }) {
        return updatedAt < Date.now() - TWO_FACTOR_REQUEST_DURATION_MS;
    },

    listAllRecoveryMethods(accountId) {
        return SequelizeRecoveryMethods.listAllRecoveryMethods(accountId);
    },

    listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode }) {
        return SequelizeRecoveryMethods.listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode });
    },

    resetTwoFactorRequest(accountId) {
        return SequelizeRecoveryMethods.resetTwoFactorRequest(accountId);
    },

    setSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        return SequelizeRecoveryMethods.setSecurityCode({ accountId, detail, kind, publicKey, securityCode });
    },

    updateRecoveryMethod({ accountId, detail, kind, securityCode }) {
        return SequelizeRecoveryMethods.updateRecoveryMethod({
            accountId,
            detail,
            kind,
            securityCode,
        });
    },

    updateTwoFactorRecoveryMethod({ accountId, detail, kind, requestId, securityCode }) {
        return SequelizeRecoveryMethods.updateTwoFactorRecoveryMethod({
            accountId,
            detail,
            kind,
            requestId,
            securityCode,
        });
    },
};

module.exports = RecoveryMethodService;
