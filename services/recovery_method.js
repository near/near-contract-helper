const { Op } = require('sequelize');

const models = require('../models');

const { Account, RecoveryMethod } = models;

const TWO_FACTOR_REQUEST_DURATION_MS = 30 * 60000;
const WRITE_TO_POSTGRES = true;

const RecoveryMethodService = {
    async createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? this.createRecoveryMethod_sequelize({
                accountId,
                detail,
                kind,
                publicKey,
                requestId,
                securityCode,
            }) : []),
        ]);

        return postgresMethod;
    },

    async createRecoveryMethod_sequelize({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const method = await RecoveryMethod.create({
            accountId,
            kind,
            ...(detail && { detail }),
            ...(publicKey && { publicKey }),
            ...(requestId && { requestId }),
            ...(securityCode && { securityCode }),
        });

        return method.toJSON();
    },

    deleteOtherRecoveryMethods({ accountId, detail }) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? this.deleteOtherRecoveryMethods_sequelize({ accountId, detail }) : []),
        ]);
    },

    async deleteOtherRecoveryMethods_sequelize({ accountId, detail }) {
        const account = await Account.findOne({ where: { accountId } });
        const allRecoveryMethods = await account.getRecoveryMethods();
        for (const rm of allRecoveryMethods) {
            if (rm.detail !== detail) {
                await rm.destroy();
            }
        }
    },

    deleteRecoveryMethod({ accountId, kind, publicKey }) {
        return ([
            ...(WRITE_TO_POSTGRES ? this.deleteRecoveryMethod_sequelize({ accountId, kind, publicKey }) : []),
        ]);
    },

    async deleteRecoveryMethod_sequelize({ accountId, kind, publicKey }) {
        const [recoveryMethod] = await RecoveryMethod.findAll({
            where: {
                accountId,
                kind,
                publicKey,
            }
        });

        return recoveryMethod.destroy();
    },

    async getRecoveryMethod({ accountId, kind, detail }) {
        return this.getRecoveryMethod_sequelize({ accountId, kind, detail });
    },

    async getRecoveryMethod_sequelize({ accountId, kind, detail }) {
        const [recoveryMethod] = await RecoveryMethod.findAll({
            where: {
                accountId,
                kind: kind.split('2fa-')[1],
                detail,
            }
        });

        return recoveryMethod;
    },

    async getTwoFactorRecoveryMethod(accountId) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod_sequelize(accountId);
        return twoFactorRecoveryMethod.toJSON();
    },

    async getTwoFactorRecoveryMethod_sequelize(accountId) {
        const [twoFactorRecoveryMethod] = await RecoveryMethod.findAll({
            where: {
                accountId,
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
        const methods = await RecoveryMethod.findAll({ where: { accountId } });
        return methods.map((method) => {
            const { securityCode, ...filteredModel } = method.toJSON();
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
        const filterArgs = { detail, kind, publicKey, securityCode };
        const queryArgs = Object.keys(filterArgs).reduce((args, key) => {
            const value = filterArgs[key];
            if (value !== null && value !== undefined) {
                args[key] = value;
            }

            return args;
        }, {});

        const recoveryMethods = await RecoveryMethod.findAll({
            where: {
                accountId,
                ...queryArgs,
            },
        });

        return recoveryMethods.map((method) => method.toJSON());
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
            ...(WRITE_TO_POSTGRES ? this.setSecurityCode_sequelize({ accountId, detail, kind, publicKey, securityCode }) : []),
        ]);

        return postgresMethod;
    },

    async setSecurityCode_sequelize({ accountId, detail, kind, publicKey, securityCode }) {
        const [recoveryMethod] = await RecoveryMethod.findOne({
            where: {
                accountId,
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
