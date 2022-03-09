const { IDENTITY_VERIFICATION_METHOD_KINDS } = require('../constants');
const {
    getIdentityVerificationMethod,
    getIdentityVerificationMethodByUniqueKey,
    updateIdentityVerificationMethod,
} = require('../db/methods/identity_verification_method');
const { USE_DYNAMODB } = require('../features');
const SequelizeIdentityVerificationMethods = require('./sequelize/identity_verification_method');

const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;

class IdentityVerificationMethodService {
    constructor(params = {
        db: {
            getIdentityVerificationMethod,
            getIdentityVerificationMethodByUniqueKey,
            updateIdentityVerificationMethod,
        },
        sequelize: SequelizeIdentityVerificationMethods,
    }) {
        this.db = params.db;
        this.sequelize = params.sequelize;
    }

    claimIdentityVerificationMethod({ identityKey, kind }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.claimIdentityVerificationMethod({ identityKey, kind });
        }
        return updateIdentityVerificationMethod({
            identityKey,
            kind,
        }, {
            claimed: true,
            securityCode: null,
        });
    }

    getIdentityVerificationMethod({ identityKey, kind }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.getIdentityVerificationMethod({ identityKey, kind });
        }
        return this.db.getIdentityVerificationMethod(identityKey);
    }

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
    }

    async recoverIdentity({ identityKey, kind, securityCode }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.recoverIdentity({ identityKey, kind, securityCode });
        }

        // if identityKey is an email, map it to its deliverable email address
        // i.e. a+0@gmail.com and a+1@gmail.com, despite being distinct addresses, will both be delivered to a@gmail.com
        const uniqueEmailKey = (kind === IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL ? this.getUniqueEmail(identityKey) : null);
        if (uniqueEmailKey) {
            // look up documents with the same deliverable email address as the provided identityKey
            const identityVerificationMethod = await this.db.getIdentityVerificationMethodByUniqueKey(uniqueEmailKey);

            // if a document exists with the same deliverable email address, but does not have the same identity key as the one provided
            // to this method, then the method call is attempting to add a key considered to be a duplicate and should not be created
            if (identityVerificationMethod && identityVerificationMethod.identityKey !== identityKey) {
                return false;
            }
        }

        // if an identity verification method exists for this identityKey but with a different kind then it cannot be recovered
        let identityVerificationMethod = await this.db.getIdentityVerificationMethod(identityKey);
        if (identityVerificationMethod && identityVerificationMethod.kind !== kind) {
            return false;
        }

        // create new identity verification method if one does not already exist for the given identityKey and kind
        identityVerificationMethod = await this.db.updateIdentityVerificationMethod({
            identityKey,
        }, {
            kind,
            securityCode,
            ...(uniqueEmailKey && { uniqueIdentityKey: uniqueEmailKey }),
        });

        return !identityVerificationMethod.claimed;
    }
}

module.exports = IdentityVerificationMethodService;
