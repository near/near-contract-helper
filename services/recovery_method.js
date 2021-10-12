const models = require('../models');

const { Account, RecoveryMethod } = models;

const WRITE_TO_POSTGRES = true;

const RecoveryMethodService = {
    createRecoveryMethod({ accountId, kind, publicKey, securityCode = null }) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? this.createRecoveryMethod_sequelize({ accountId, kind, publicKey, securityCode }) : []),
        ]);
    },

    async createRecoveryMethod_sequelize({ accountId, kind, publicKey, securityCode = null }) {
        const method = await RecoveryMethod.create({
            accountId,
            kind,
            publicKey,
            ...(securityCode && { securityCode }),
        });

        return method.toJSON();
    },

    deleteOtherRecoveryMethods({ accountId, detail }) {
        return ([
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

    setSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? this.setSecurityCode_sequelize({ accountId, detail, kind, publicKey, securityCode }) : []),
        ]);
    },

    // TODO are all params needed to uniquely identify the RecoveryMethod?
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
};

module.exports = RecoveryMethodService;
