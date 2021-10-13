const SequelizeRecoveryMethods = require('./sequelize/recovery_method');

const TWO_FACTOR_REQUEST_DURATION_MS = 30 * 60000;
const WRITE_TO_POSTGRES = true;

const RecoveryMethodService = {
    async createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeRecoveryMethods.createRecoveryMethod({
                accountId,
                detail,
                kind,
                publicKey,
                requestId,
                securityCode,
            })]: []),
        ]);

        return postgresMethod;
    },

    deleteOtherRecoveryMethods({ accountId, detail }) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeRecoveryMethods.deleteOtherRecoveryMethods({ accountId, detail })] : []),
        ]);
    },

    deleteRecoveryMethod({ accountId, kind, publicKey }) {
        return ([
            ...(WRITE_TO_POSTGRES ? [SequelizeRecoveryMethods.deleteRecoveryMethod({ accountId, kind, publicKey })] : []),
        ]);
    },

    async getRecoveryMethod({ accountId, kind, detail }) {
        const recoveryMethod = await SequelizeRecoveryMethods.getRecoveryMethod({ accountId, kind, detail });
        return SequelizeRecoveryMethods.cleanRecoveryMethod(recoveryMethod);
    },

    async getTwoFactorRecoveryMethod(accountId) {
        const twoFactorRecoveryMethod = await SequelizeRecoveryMethods.getTwoFactorRecoveryMethod(accountId);
        return SequelizeRecoveryMethods.cleanRecoveryMethod(twoFactorRecoveryMethod);
    },

    isTwoFactorRequestExpired({ updatedAt }) {
        return updatedAt < Date.now() - TWO_FACTOR_REQUEST_DURATION_MS;
    },

    listAllRecoveryMethods(accountId) {
        return SequelizeRecoveryMethods.listAllRecoveryMethods(accountId);
    },

    async listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode }) {
        return SequelizeRecoveryMethods.listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode });
    },

    async resetTwoFactorRequest(accountId) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? SequelizeRecoveryMethods.resetTwoFactorRequest(accountId) : []),
        ]);

        return postgresMethod;
    },

    async setSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeRecoveryMethods.setSecurityCode({ accountId, detail, kind, publicKey, securityCode })] : []),
        ]);

        return postgresMethod;
    },

    async updateTwoFactorRecoveryMethod({ accountId, detail, kind, requestId, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? SequelizeRecoveryMethods.updateTwoFactorRecoveryMethod({
                accountId,
                detail,
                kind,
                requestId,
                securityCode,
            }) : []),
        ]);

        return postgresMethod;
    },
};

module.exports = RecoveryMethodService;
