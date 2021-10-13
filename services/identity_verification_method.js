const SequelizeIdentityVerificationMethods = require('./sequelize/identity_verification_method');

const WRITE_TO_POSTGRES = true;

const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;

const IdentityVerificationMethodService = {
    async claimIdentityVerificationMethod({ identityKey, kind }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeIdentityVerificationMethods.claimIdentityVerificationMethod({ identityKey, kind })] : [])
        ]);

        return postgresMethod;
    },

    async getIdentityVerificationMethod({ identityKey, kind }) {
        const [postgresMethod] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeIdentityVerificationMethods.getIdentityVerificationMethod({ identityKey, kind })] : [])
        ]);

        return postgresMethod;
    },

    // Identify what gmail would consider the 'root' email for a given email address
    // GMail ignores things like . and +
    getUniqueEmail(email) {
        if (!email.includes('@')) {
            return '';
        }

        const [usernameWithPossibleAlias, inputDomain] = email.split('@');
        const domain = inputDomain.replace('googlemail.com', 'gmail.com');

        const username = usernameWithPossibleAlias
            .split('+')[0]
            .replace(MATCH_GMAIL_IGNORED_CHARS, '');

        return `${username}@${domain}`.toLowerCase();
    },

    // return the IdentityVerificationMethod record when successful, null when invalid
    async recoverIdentity({ identityKey, kind, securityCode }) {
        const [postgresSuccess] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeIdentityVerificationMethods.recoverIdentity({ identityKey, kind, securityCode })] : []),
        ]);

        return postgresSuccess;
    },
};

module.exports = IdentityVerificationMethodService;
