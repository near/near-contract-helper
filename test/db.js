const models = require('../models');

module.exports = {
    async deleteAllRows() {
        await models.EmailDomainBlacklist.destroy({ where: {} });
        await models.IdentityVerificationMethod.destroy({ where: {} });
        await models.RecoveryMethod.destroy({ where: {} });
        await models.Account.destroy({ where: {} });
    },
};
