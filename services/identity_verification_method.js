const SequelizeIdentityVerificationMethods = require('./sequelize/identity_verification_method');

const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;

const IdentityVerificationMethodService = {
    claimIdentityVerificationMethod({ identityKey, kind }) {
        return SequelizeIdentityVerificationMethods.claimIdentityVerificationMethod({ identityKey, kind });
    },

    getIdentityVerificationMethod({ identityKey, kind }) {
        return SequelizeIdentityVerificationMethods.getIdentityVerificationMethod({ identityKey, kind });
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
    recoverIdentity({ identityKey, kind, securityCode }) {
        return SequelizeIdentityVerificationMethods.recoverIdentity({ identityKey, kind, securityCode });
    },
};

module.exports = IdentityVerificationMethodService;
