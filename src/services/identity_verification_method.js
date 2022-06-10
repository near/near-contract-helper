const {
    getIdentityVerificationMethod,
    updateIdentityVerificationMethod,
} = require('../db/methods/identity_verification_method');

const MATCH_GMAIL_IGNORED_CHARS = /[|&;$%@"<>()+,!#'*\-\/=?^_`.{}]/g;

class IdentityVerificationMethodService {
    constructor(params = {
        db: {
            getIdentityVerificationMethod,
            updateIdentityVerificationMethod,
        },
    }) {
        this.db = params.db;
    }

    async claimIdentityVerificationMethod({ identityKey, kind }) {
        // do not upsert documents that do not exist or exist under a different kind
        const identityVerificationMethod = await this.getIdentityVerificationMethod({ identityKey });
        if (!identityVerificationMethod || identityVerificationMethod.kind !== kind) {
            return null;
        }

        return this.db.updateIdentityVerificationMethod({
            uniqueIdentityKey: this.getUniqueIdentityKey(identityKey),
        }, {
            claimed: true,
            securityCode: null,
        });
    }

    getIdentityVerificationMethod({ identityKey }) {
        return this.db.getIdentityVerificationMethod(this.getUniqueIdentityKey(identityKey));
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

    getUniqueIdentityKey(identityKey) {
        return this.getUniqueEmail(identityKey) || identityKey;
    }

    async recoverIdentity({ identityKey, kind, securityCode }) {
        const identityVerificationMethod = await this.getIdentityVerificationMethod({ identityKey });

        // allow recovery when no record exists for the given identity or the record is unclaimed and matches the given kind
        const isRecoverable = !identityVerificationMethod
            || (
                identityVerificationMethod.kind === kind
                && identityVerificationMethod.identityKey === identityKey
                && !identityVerificationMethod.claimed
            );

        if (!isRecoverable) {
            return false;
        }

        // create new identity verification method if one does not already exist for the given identityKey and kind
        await this.db.updateIdentityVerificationMethod({
            uniqueIdentityKey: this.getUniqueIdentityKey(identityKey),
        }, {
            identityKey,
            kind,
            securityCode,
        });

        return true;
    }
}

module.exports = IdentityVerificationMethodService;
