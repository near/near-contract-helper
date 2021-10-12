const models = require('../models');
const constants = require('../constants');

const { IDENTITY_VERIFICATION_METHOD_KINDS } = constants;
const { IdentityVerificationMethod } = models;

const WRITE_TO_POSTGRES = true;

const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;

const IdentityVerificationMethodService = {
    getIdentityVerificationMethod({ identityKey, kind }) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? [this.getIdentityVerificationMethod_sequelize({ identityKey, kind })] : [])
        ]);
    },

    async getIdentityVerificationMethod_sequelize({ identityKey, kind }) {
        const [verificationMethod] = await IdentityVerificationMethod.findOne({
            where: {
                identityKey,
                kind,
            },
        });

        return verificationMethod.toJSON();
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
        const [isSuccessful] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [this.recoverIdentity_sequelize({ identityKey, kind, securityCode })] : []),
        ]);

        return isSuccessful;
    },

    async recoverIdentity_sequelize({ identityKey, kind, securityCode }) {
        try {
            const [verificationMethod, verificationMethodCreated] = await IdentityVerificationMethod.findOrCreate({
                where: {
                    identityKey: identityKey.toLowerCase(),
                    kind,
                },
                defaults: {
                    securityCode,
                    uniqueIdentityKey: kind === IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL ? this.getUniqueEmail(identityKey) : null,
                }
            });

            if (verificationMethod.claimed) {
                return false;
            }

            if (!verificationMethodCreated) {
                await verificationMethod.update({ securityCode });
            }

            return true;
        } catch (e) {
            // UniqueConstraintError thrown due to one of the following:
            // - provided `identityKey` already exists with a different value for `kind`
            // - provided `identityKey` doesn't exist but a row with the same `uniqueIdentityKey` does
            if (e.original && e.original.code === '23505') {
                return false;
            }

            throw e;
        }
    },
};

module.exports = IdentityVerificationMethodService;
