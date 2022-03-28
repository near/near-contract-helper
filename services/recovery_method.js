const {
    createRecoveryMethod,
    deleteRecoveryMethod,
    getRecoveryMethodByIdentity,
    listRecoveryMethodsByAccountId,
    updateRecoveryMethod,
} = require('../db/methods/recovery_method');

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
    }) {
        this.db = params.db;
    }

    createRecoveryMethod({ accountId, detail, kind, publicKey, requestId, securityCode }) {
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
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) => recoveryMethod.detail !== detail)
            .map((recoveryMethod) => this.db.deleteRecoveryMethod(recoveryMethod));
    }

    deleteRecoveryMethod({ accountId, kind, publicKey }) {
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) => recoveryMethod.kind === kind && recoveryMethod.publicKey === publicKey)
            .map((recoveryMethod) => this.db.deleteRecoveryMethod(recoveryMethod));
    }

    getTwoFactorRecoveryMethod(accountId) {
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .filter((recoveryMethod) => recoveryMethod.kind.startsWith('2fa-'))
            .get(0)
            .then((method) => method || null);
    }

    isTwoFactorRequestExpired({ updatedAt }) {
        return (new Date(updatedAt)) < (Date.now() - TWO_FACTOR_REQUEST_DURATION_MS);
    }

    listAllRecoveryMethods(accountId) {
        return this.db.listRecoveryMethodsByAccountId(accountId)
            .map(({ securityCode, ...recoveryMethod }) => ({
                ...recoveryMethod,
                confirmed: !securityCode,
                requestId: parseInt(recoveryMethod.requestId, 10),
            }));
    }

    async resetTwoFactorRequest(accountId) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod(accountId);
        if (!twoFactorRecoveryMethod) {
            return null;
        }

        return this.db.updateRecoveryMethod({
            accountId,
            kind: twoFactorRecoveryMethod.kind,
            publicKey: twoFactorRecoveryMethod.publicKey,
        }, {
            detail: twoFactorRecoveryMethod.detail,
            requestId: -1,
            securityCode: null,
        });
    }

    updateRecoveryMethod({ accountId, detail, kind, publicKey, securityCode }) {
        return this.db.updateRecoveryMethod({
            accountId,
            kind,
            publicKey,
        }, {
            detail,
            securityCode,
        });
    }

    async updateTwoFactorRecoveryMethod({ accountId, requestId, securityCode }) {
        const twoFactorRecoveryMethod = await this.getTwoFactorRecoveryMethod(accountId);
        if (!twoFactorRecoveryMethod) {
            return null;
        }

        return this.db.updateRecoveryMethod({
            accountId,
            kind: twoFactorRecoveryMethod.kind,
            publicKey: twoFactorRecoveryMethod.publicKey,
        }, {
            detail: twoFactorRecoveryMethod.detail,
            requestId,
            securityCode,
        });
    }

    async validateSecurityCode({ accountId, detail, kind, publicKey, securityCode }) {
        if (!publicKey) {
            const [recoveryMethod] = await this.db.listRecoveryMethodsByAccountId(accountId)
                .filter((recoveryMethod) =>
                    recoveryMethod.detail === detail
                    && recoveryMethod.kind === kind
                    && recoveryMethod.securityCode === securityCode
                );

            return !!recoveryMethod;
        }

        const recoveryMethod = await this.db.getRecoveryMethodByIdentity({
            accountId,
            kind,
            publicKey,
        });

        return !!recoveryMethod && recoveryMethod.detail === detail && recoveryMethod.securityCode === securityCode;
    }
}

module.exports = RecoveryMethodService;
