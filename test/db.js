const { execSync } = require('child_process');

const models = require('../models');

module.exports = {
    async deleteAllRows() {
        await models.EmailDomainBlacklist.destroy({ where: {} });
        await models.IdentityVerificationMethod.destroy({ where: {} });
        await models.RecoveryMethod.destroy({ where: {} });
        await models.Account.destroy({ where: {} });
    },

    async initDb() {
        await new Promise((resolve, reject) => {
            try {
                execSync('yarn migrate');
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    },
};
