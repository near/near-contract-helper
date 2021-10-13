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
            requestId,
            securityCode,
            createdAt,
            updatedAt,
        };
    },

    async createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            return null;
        }

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

    async getRecoveryMethod({ accountId, kind, detail }) {
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
        const account = await Account.findOne({ where: { accountId } });
        const recoveryMethods = await account.getRecoveryMethods({
            where: {
                ...(detail && { detail }),
                ...(kind && { kind }),
                ...(publicKey && { publicKey }),
                ...(securityCode && { securityCode }),
            },
        });

        return recoveryMethods.map((recoveryMethod) => this.cleanRecoveryMethod(recoveryMethod));
    },

    async resetTwoFactorRequest(accountId) {
        const twoFactorMethod = await this.getTwoFactorRecoveryMethod(accountId);
        await twoFactorMethod.update({ requestId: -1, securityCode: null });

        // sequelize updates don't actually return anything useful but we'll want the
        // eventual interface to return the updated object so use a placeholder for now
        return {};
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
        return recoveryMethod.toJSON();
    },

    async updateTwoFactorRecoveryMethod({ accountId, detail, kind, requestId, securityCode }) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod(accountId);
        await twoFactorRecoveryMethod.update({
            requestId,
            ...(detail && { detail }),
            ...(kind && { kind }),
            ...(securityCode && { securityCode }),
        });

        return {};
    },
};

module.exports = SequelizeRecoveryMethods;
