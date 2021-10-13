const { Op } = require('sequelize');

const models = require('../models');

const { Account } = models;

const TWO_FACTOR_REQUEST_DURATION_MS = 30 * 60000;
const WRITE_TO_POSTGRES = true;

const RecoveryMethodService = {
    cleanRecoveryMethod_sequelize(recoveryMethod) {
        if (!recoveryMethod) {
            return null;
        }

        const {
            kind,
            detail,
            publicKey,
            requestId,
            securityCode,
            createdAt,
            updatedAt,
        } = recoveryMethod.toJSON();

        return {
            kind,
            detail,
            publicKey,
            requestId,
            securityCode,
            createdAt,
            updatedAt,
        };
    },

    async createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [this.createRecoveryMethod_sequelize({
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

    async createRecoveryMethod_sequelize({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            // TODO throw exception
            return null;
        }

        const recoveryMethod = await account.createRecoveryMethod({
            kind,
            ...(detail && { detail }),
            ...(publicKey && { publicKey }),
            ...(requestId && { requestId }),
            ...(securityCode && { securityCode }),
        });

        return this.cleanRecoveryMethod_sequelize(recoveryMethod);
    },

    deleteOtherRecoveryMethods({ accountId, detail }) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? this.deleteOtherRecoveryMethods_sequelize({ accountId, detail }) : []),
        ]);
    },

    async deleteOtherRecoveryMethods_sequelize({ accountId, detail }) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            return null;
        }

        const allRecoveryMethods = await account.getRecoveryMethods();
        for (const rm of allRecoveryMethods) {
            if (rm.detail !== detail) {
                await rm.destroy();
            }
        }
    },

    deleteRecoveryMethod({ accountId, kind, publicKey }) {
        return ([
            ...(WRITE_TO_POSTGRES ? [this.deleteRecoveryMethod_sequelize({ accountId, kind, publicKey })] : []),
        ]);
    },

    async deleteRecoveryMethod_sequelize({ accountId, kind, publicKey }) {
        const account = await Account.findOne({ where: { accountId } });
        const [recoveryMethod] = await account.getRecoveryMethods({
            where: {
                kind,
                publicKey,
            }
        });

        return recoveryMethod.destroy();
    },

    async getRecoveryMethod({ accountId, kind, detail }) {
        const recoveryMethod = await this.getRecoveryMethod_sequelize({ accountId, kind, detail });
        return this.cleanRecoveryMethod_sequelize(recoveryMethod);
    },

    async getRecoveryMethod_sequelize({ accountId, kind, detail }) {
        const account = await Account.findOne({ where: { accountId } });
        const [recoveryMethod] = await account.getRecoveryMethods({
            where: {
                kind: kind.split('2fa-')[1],
                detail,
            }
        });

        return recoveryMethod;
    },

    async getTwoFactorRecoveryMethod(accountId) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod_sequelize(accountId);
        return this.cleanRecoveryMethod_sequelize(twoFactorRecoveryMethod);
    },

    async getTwoFactorRecoveryMethod_sequelize(accountId) {
        const account = await Account.findOne({ where: { accountId } });
        const [twoFactorRecoveryMethod] = await account.getRecoveryMethods({
            where: {
                kind: {
                    [Op.startsWith]: '2fa-'
                },
            },
        });

        return twoFactorRecoveryMethod;
    },

    isTwoFactorRequestExpired({ updatedAt }) {
        return updatedAt < Date.now() - TWO_FACTOR_REQUEST_DURATION_MS;
    },

    listAllRecoveryMethods(accountId) {
        return this.listAllRecoveryMethods_sequelize(accountId);
    },

    async listAllRecoveryMethods_sequelize(accountId) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            return [];
        }

        const recoveryMethods = await account.getRecoveryMethods();
        return recoveryMethods.map((recoveryMethod) => {
            const { securityCode, ...filteredModel } = this.cleanRecoveryMethod_sequelize(recoveryMethod);
            return {
                ...filteredModel,
                confirmed: !securityCode,
            };
        });
    },

    async listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode }) {
        return this.listRecoveryMethods_sequelize({ accountId, detail, kind, publicKey, securityCode });
    },

    async listRecoveryMethods_sequelize({ accountId, detail, kind, publicKey, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        const recoveryMethods = await account.getRecoveryMethods({
            where: {
                ...(detail && { detail }),
                ...(kind && { kind }),
                ...(publicKey && { publicKey }),
                ...(securityCode && { securityCode }),
            },
        });

        return recoveryMethods.map((recoveryMethod) => this.cleanRecoveryMethod_sequelize(recoveryMethod));
    },

    async resetTwoFactorRequest(accountId) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? this.resetTwoFactorRequest_sequelize(accountId) : []),
        ]);

        return postgresMethod;
    },

    async resetTwoFactorRequest_sequelize(accountId) {
        const twoFactorMethod = await this.getTwoFactorRecoveryMethod_sequelize(accountId);
        await twoFactorMethod.update({ requestId: -1, securityCode: null });

        // sequelize updates don't actually return anything useful but we'll want the
        // eventual interface to return the updated object so use a placeholder for now
        return {};
    },

    async setSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [this.setSecurityCode_sequelize({ accountId, detail, kind, publicKey, securityCode })] : []),
        ]);

        return postgresMethod;
    },

    async setSecurityCode_sequelize({ accountId, detail, kind, publicKey, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        const [recoveryMethod] = await account.getRecoveryMethods({
            where: {
                detail,
                kind,
                publicKey,
            },
        });

        await recoveryMethod.update({ securityCode });
        return recoveryMethod.toJSON();
    },

    async updateTwoFactorRecoveryMethod({ accountId, detail, kind, requestId, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? this.updateTwoFactorRecoveryMethod_sequelize({
                accountId,
                detail,
                kind,
                requestId,
                securityCode,
            }) : []),
        ]);

        return postgresMethod;
    },

    async updateTwoFactorRecoveryMethod_sequelize({ accountId, detail, kind, requestId, securityCode }) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod_sequelize(accountId);
        await twoFactorRecoveryMethod.update({
            requestId,
            ...(detail && { detail }),
            ...(kind && { kind }),
            ...(securityCode && { securityCode }),
        });

        return {};
    },
};

module.exports = RecoveryMethodService;
