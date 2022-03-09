const { RECOVERY_METHOD_KINDS } = require('../constants');
const {
    createRecoveryMethod,
    deleteRecoveryMethod,
    getRecoveryMethodByIdentity,
    listRecoveryMethodsByAccountId,
    updateRecoveryMethod,
} = require('../db/methods/recovery_method');
const { USE_DYNAMODB } = require('../features');
const SequelizeRecoveryMethods = require('./sequelize/recovery_method');

const TWO_FACTOR_REQUEST_DURATION_MS = 30 * 60000;

class RecoveryMethodService {
    constructor(params = {
        db: {
            createRecoveryMethod,
            deleteRecoveryMethod,
            getRecoveryMethodByIdentity,
            listRecoveryMethodsByAccountId,
            updateRecoveryMethod,
        },
        sequelize: SequelizeRecoveryMethods,
    }) {
        this.db = params.db;
        this.sequelize = params.sequelize;
    }

    createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.createRecoveryMethod({
                accountId,
                detail,
                kind,
                publicKey,
                requestId,
                securityCode,
            });
        }
        return this.db.createRecoveryMethod({
            accountId,
            detail,
            kind,
            publicKey,
            requestId,
            securityCode,
        });
    }

    deleteOtherRecoveryMethods({ accountId, detail }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.deleteOtherRecoveryMethods({ accountId, detail });
        }
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) => recoveryMethod.detail !== detail)
            .map((recoveryMethod) => deleteRecoveryMethod(recoveryMethod));
    }

    deleteRecoveryMethod({ accountId, kind, publicKey }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.deleteRecoveryMethod({ accountId, kind, publicKey });
        }
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) => recoveryMethod.kind === kind && recoveryMethod.publicKey === publicKey)
            .map((recoveryMethod) => deleteRecoveryMethod(recoveryMethod));
    }

    getTwoFactorRecoveryMethod(accountId) {
        if (!USE_DYNAMODB) {
            return this.sequelize.getTwoFactorRecoveryMethod(accountId);
        }
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) => recoveryMethod.kind.startsWith('2fa-'))
            .get(0)
            .then((method) => method || null);
    }

    isTwoFactorRequestExpired({ updatedAt }) {
        return updatedAt < (Date.now() - TWO_FACTOR_REQUEST_DURATION_MS);
    }

    listAllRecoveryMethods(accountId) {
        if (!USE_DYNAMODB) {
            return this.sequelize.listAllRecoveryMethods(accountId);
        }
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .map(({ securityCode, ...recoveryMethod }) => ({
                ...recoveryMethod,
                confirmed: !securityCode,
                requestId: parseInt(recoveryMethod.requestId, 10),
            }));
    }

    async listRecoveryMethods({ accountId, detail, kind, publicKey, securityCode }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.listRecoveryMethods({
                accountId,
                detail,
                kind,
                publicKey,
                securityCode
            });
        }

        const hasSecurityCode = !!(securityCode || securityCode === 0);

        // the table keys can be used to uniquely identify a recovery method document if either:
        // - all constituent properties of the composite index are provided to this method
        // - the recovery method kind indicates that a value for detail will never be reported because it does not exist or is private
        // if neither condition is met then the property either does not exist or has been omitted, but the
        // since the distinction cannot reliably be made, all recovery methods for the account will be fetched
        const hasConstituentKeys = detail && kind && publicKey;
        const noDetailReported = [
            RECOVERY_METHOD_KINDS.LEDGER,
            RECOVERY_METHOD_KINDS.PHRASE,
        ].includes(kind);

        if (noDetailReported || hasConstituentKeys) {
            const recoveryMethod = await this.db.getRecoveryMethodByIdentity({
                accountId,
                detail,
                kind,
                publicKey,
            });

            if (!recoveryMethod || (hasSecurityCode && recoveryMethod.securityCode !== securityCode)) {
                return [];
            }

            return [recoveryMethod];
        }

        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) =>
                (!detail || detail === recoveryMethod.detail)
                && (!kind || kind === recoveryMethod.kind)
                && (!publicKey || publicKey === recoveryMethod.publicKey)
                && (!hasSecurityCode || securityCode === recoveryMethod.securityCode)
            );
    }

    async resetTwoFactorRequest(accountId) {
        if (!USE_DYNAMODB) {
            return this.sequelize.resetTwoFactorRequest(accountId);
        }
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod(accountId);
        if (!twoFactorRecoveryMethod) {
            return null;
        }

        return this.db.updateRecoveryMethod({
            accountId,
            detail: twoFactorRecoveryMethod.detail,
            kind: twoFactorRecoveryMethod.kind,
            publicKey: twoFactorRecoveryMethod.publicKey,
        }, {
            requestId: -1,
            securityCode: null,
        });
    }

    // TODO remove this method when removing the USE_DYNAMODB feature flag
    setSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        return this.sequelize.setSecurityCode({ accountId, detail, kind, publicKey, securityCode });
    }

    updateRecoveryMethod({ accountId, detail, kind, publicKey, securityCode }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.updateRecoveryMethod({
                accountId,
                detail,
                kind,
                securityCode,
            });
        }
        return this.db.updateRecoveryMethod({
            accountId,
            detail,
            kind,
            publicKey,
        }, {
            securityCode,
        });
    }

    async updateTwoFactorRecoveryMethod({ accountId, detail, kind, requestId, securityCode }) {
        if (!USE_DYNAMODB) {
            return this.sequelize.updateTwoFactorRecoveryMethod({
                accountId,
                detail,
                kind,
                requestId,
                securityCode,
            });
        }
        // FIXME leaving this for consistency with existing implementation for now, but this should work as an
        //  identity lookup if the composite key parameters are always provided
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod(accountId);
        if (!twoFactorRecoveryMethod) {
            return null;
        }

        return this.db.updateRecoveryMethod({
            accountId,
            detail: twoFactorRecoveryMethod.detail,
            kind: twoFactorRecoveryMethod.kind,
            publicKey: twoFactorRecoveryMethod.publicKey,
        }, {
            requestId,
            securityCode,
        });
    }
}

module.exports = RecoveryMethodService;
