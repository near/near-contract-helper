const stampit = require('@stamp/it');

const { IDENTITY_VERIFICATION_METHOD_KINDS } = require('../constants');
const {
    getIdentityVerificationMethod,
    getIdentityVerificationMethodByUniqueKey,
    updateIdentityVerificationMethod,
} = require('../db/methods/identity_verification_method');
const { USE_DYNAMODB } = require('../features');
const SequelizeIdentityVerificationMethods = require('./sequelize/identity_verification_method');

const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;

const IdentityVerificationMethodService = stampit({
    methods: {
        claimIdentityVerificationMethod({ identityKey, kind }) {
            if (!USE_DYNAMODB) {
                return SequelizeIdentityVerificationMethods.claimIdentityVerificationMethod({ identityKey, kind });
            }
            return updateIdentityVerificationMethod({
                identityKey,
                kind,
            }, {
                claimed: true,
                securityCode: null,
            });
        },

        getIdentityVerificationMethod({ identityKey, kind }) {
            if (!USE_DYNAMODB) {
                return SequelizeIdentityVerificationMethods.getIdentityVerificationMethod({ identityKey, kind });
            }
            return getIdentityVerificationMethod({ identityKey, kind });
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
            if (!USE_DYNAMODB) {
                return SequelizeIdentityVerificationMethods.recoverIdentity({ identityKey, kind, securityCode });
            }

            // if identityKey is an email, map it to its deliverable email address
            // i.e. a+0@gmail.com and a+1@gmail.com, despite being distinct addresses, will both be delivered to a@gmail.com
            const uniqueEmailKey = (kind === IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL ? this.getUniqueEmail(identityKey) : null);
            if (uniqueEmailKey) {
                // look up documents with the same deliverable email address as the provided identityKey
                const duplicateIdentityVerificationMethod = await getIdentityVerificationMethodByUniqueKey(uniqueEmailKey);

                // if a document exists with the same deliverable email address, but does not have the same identity key as the one provided
                // to this method, then the method call is attempting to add a key considered to be a duplicate and should not be created
                if (duplicateIdentityVerificationMethod && duplicateIdentityVerificationMethod.identityKey !== identityKey) {
                    return null;
                }
            }

            // create new identity verification method if one does not already exist for the given identityKey and kind
            return updateIdentityVerificationMethod({
                identityKey,
                kind,
            }, {
                securityCode,
                ...(uniqueEmailKey && { uniqueIdentityKey: uniqueEmailKey }),
            });
        },
    },
});

module.exports = IdentityVerificationMethodService;
