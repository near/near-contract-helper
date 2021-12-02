const models = require('../../models');
const constants = require('../../constants');

const { IDENTITY_VERIFICATION_METHOD_KINDS } = constants;
const { IdentityVerificationMethod } = models;

const SequelizeIdentityVerificationMethods = {
    async claimIdentityVerificationMethod({ identityKey, kind }) {
        return IdentityVerificationMethod.update(
            {
                claimed: true,
                securityCode: null,
            },
            {
                where: {
                    identityKey,
                    kind,
                },
            });
    },

    async getIdentityVerificationMethod({ identityKey, kind }) {
        const verificationMethod = await IdentityVerificationMethod.findOne({
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
        const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;
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

    async recoverIdentity({ identityKey, kind, securityCode }) {
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

module.exports = SequelizeIdentityVerificationMethods;
