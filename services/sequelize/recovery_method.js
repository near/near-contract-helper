const { Op } = require('sequelize');

const models = require('../../models');

const { Account } = models;

const SequelizeRecoveryMethods = {
    cleanRecoveryMethod(recoveryMethod) {
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
            requestId: parseInt(requestId, 10),
            securityCode,
            createdAt,
            updatedAt,
        };
    },

    async createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        const recoveryMethod = await account.createRecoveryMethod({
            kind,
            ...(detail && { detail }),
            ...(publicKey && { publicKey }),
            ...(requestId && { requestId }),
            ...(securityCode && { securityCode }),
        });

        return this.cleanRecoveryMethod(recoveryMethod);
    },

    async deleteOtherRecoveryMethods({ accountId, detail }) {
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

    async deleteRecoveryMethod({ accountId, kind, publicKey }) {
        const account = await Account.findOne({ where: { accountId } });
        const [recoveryMethod] = await account.getRecoveryMethods({
            where: {
                kind,
                publicKey,
            }
        });

        return recoveryMethod.destroy();
    },

    async getTwoFactorRecoveryMethod(accountId) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod_internal(accountId);
        return this.cleanRecoveryMethod(twoFactorRecoveryMethod);
    },

    async getTwoFactorRecoveryMethod_internal(accountId) {
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

    async listAllRecoveryMethods(accountId) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            return [];
        }

        const recoveryMethods = await account.getRecoveryMethods();
        return recoveryMethods.map((recoveryMethod) => {
            const { securityCode, ...filteredModel } = this.cleanRecoveryMethod(recoveryMethod);
            return {
                ...filteredModel,
                confirmed: !securityCode,
            };
        });
    },

    async listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode }) {
        const recoveryMethods = await this.listRecoveryMethods_internal({ accountId, detail, kind, publicKey, securityCode });
        return recoveryMethods.map((recoveryMethod) => this.cleanRecoveryMethod(recoveryMethod));
    },

    async listRecoveryMethods_internal({ accountId, detail, kind, publicKey, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        const methods = await account.getRecoveryMethods({
            where: {
                ...(detail && { detail }),
                ...(kind && { kind }),
                ...(publicKey && { publicKey }),
                ...(securityCode && { securityCode }),
            },
        });
        return methods;
    },

    async resetTwoFactorRequest(accountId) {
        const twoFactorMethod = await this.getTwoFactorRecoveryMethod_internal(accountId);
        await twoFactorMethod.update({ requestId: -1, securityCode: null });
        return this.cleanRecoveryMethod(twoFactorMethod);
    },

    async setSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        const [recoveryMethod] = await account.getRecoveryMethods({
            where: {
                detail,
                kind,
                publicKey,
            },
        });

        await recoveryMethod.update({ securityCode });
        return this.cleanRecoveryMethod(recoveryMethod);
    },

    async updateRecoveryMethod({ accountId, detail, kind, securityCode }) {
        const [recoveryMethod] = await this.listRecoveryMethods_internal({ accountId, detail, kind, securityCode });
        await recoveryMethod.update({
            ...(detail && { detail }),
            ...(kind && { kind }),
            ...(securityCode && { securityCode }),
        });

        return this.cleanRecoveryMethod(recoveryMethod);
    },

    async updateTwoFactorRecoveryMethod({ accountId, detail, kind, requestId, securityCode }) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod_internal(accountId);
        await twoFactorRecoveryMethod.update({
            requestId,
            ...(detail && { detail }),
            ...(kind && { kind }),
            ...(securityCode && { securityCode }),
        });

        return this.cleanRecoveryMethod(twoFactorRecoveryMethod);
    },
};

module.exports = SequelizeRecoveryMethods;
