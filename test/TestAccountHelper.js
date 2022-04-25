const nearAPI = require('near-api-js');
const uuid = require('uuid');

const constants = require('../constants');
const RecoveryMethodService = require('../services/recovery_method');
const AccountService = require('../services/account');

const { SERVER_EVENTS, TWO_FACTOR_AUTH_KINDS } = constants;

const recoveryMethodService = new RecoveryMethodService();
const accountService = new AccountService();

class TestAccountHelper {
    constructor({
        app,
        ECHO_SECURITY_CODES = false,
        keyPair,
        keyStore,
        request,
    }) {
        this._keyPair = keyPair;
        this._keyStore = keyStore;
        this._request = request;
        this._app = app;

        this._signer = new nearAPI.InMemorySigner(this._keyStore);
        this._securityCodesByAccountId = {};

        if (this._app) {
            app.on(SERVER_EVENTS.SECURITY_CODE, ({ accountId, securityCode, requestId }) => {
                if (ECHO_SECURITY_CODES) {
                    console.log('Got security code', { accountId, securityCode, requestId });
                }
                this._securityCodesByAccountId[accountId] = securityCode;
            });
        }
    }

    async ensureNEARApiClientInitialized() {
        if (!this._NEARApiClient) {
            this._NEARApiClient = await nearAPI.connect({
                deps: { keyStore: this._keyStore },
                nodeUrl: process.env.NODE_URL
            });
        }
    }

    get near() {
        return this._NEARApiClient;
    }

    get keyStore() {
        return this._keyStore;
    }

    get publicKey() {
        return this._keyPair.publicKey.toString();
    }

    get signer() {
        return this._signer;
    }

    clearSecurityCodeForAccount(accountId) {
        delete this._securityCodesByAccountId[accountId];
    }

    getSecurityCodeForAccount(accountId) {
        const value = this._securityCodesByAccountId[accountId];
        delete this._securityCodesByAccountId[accountId];

        return value;
    }

    async getLatestBlockHeight() {
        await this.ensureNEARApiClientInitialized();

        const {
            sync_info: { latest_block_height }
        } = await this._NEARApiClient.connection.provider.status();

        return latest_block_height;
    }

    async signatureForLatestBlock({ accountId, valid }) {
        const latestBlockHeight = await this.getLatestBlockHeight();

        return this.signatureForBlockHeight({
            accountId,
            valid,
            blockHeight: latestBlockHeight,
        });
    }

    async initRecoveryMethodForTempAccount({ accountId, method, seedPhrase }) {
        this.clearSecurityCodeForAccount(accountId);

        const result = await this._request.post('/account/initializeRecoveryMethodForTempAccount')
            .send({
                accountId,
                method,
                seedPhrase,
            });

        return { result, securityCode: this.getSecurityCodeForAccount(accountId) };
    }

    async initRecoveryMethod({ accountId, method, seedPhrase, testing, valid }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        this.clearSecurityCodeForAccount(accountId);

        const result = await this._request.post('/account/initializeRecoveryMethod')
            .send({
                accountId,
                method,
                seedPhrase,
                testing,
                ...signature,
            });

        return { result, securityCode: this.getSecurityCodeForAccount(accountId) };
    }

    async validateSecurityCode({ accountId, method, securityCode, valid }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        return this._request
            .post('/account/validateSecurityCode')
            .send({
                accountId,
                method,
                securityCode,
                ...signature
            });
    }

    async getAccessKey({ accountId, valid }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        return this._request
            .post('/2fa/getAccessKey')
            .send({ accountId, ...signature });
    }

    async getRecoveryMethods({ accountId, valid }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        return this._request
            .post('/account/recoveryMethods')
            .send({ accountId, ...signature });
    }

    async create2faPhoneMethod({ accountId, method }) {
        await accountService.getOrCreateAccount(accountId);
        return recoveryMethodService.createRecoveryMethod({
            accountId,
            detail: method.detail,
            kind: method.kind,
            requestId: -1,
        });

    }

    async init2faMethod({
        accountId,
        method,
        valid,
        testContractDeployed,
        bypassEndpointCreation = false
    }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        this.clearSecurityCodeForAccount(accountId);

        if (bypassEndpointCreation && method.kind === TWO_FACTOR_AUTH_KINDS.PHONE) {
            const result = await this.create2faPhoneMethod({ accountId, method });
            await this._request
                .post('/2fa/send')
                .send({ accountId, method, requestId: -1, ...signature });

            return { result, securityCode: this.getSecurityCodeForAccount(accountId) };
        }

        const result = await this._request
            .post('/2fa/init')
            .send({ accountId, method, testContractDeployed, ...signature });

        return { result, securityCode: this.getSecurityCodeForAccount(accountId) };
    }

    async verify2faMethod({ accountId, requestId, securityCode, valid }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        return this._request
            .post('/2fa/verify')
            .send({
                accountId,
                requestId,
                securityCode,
                ...signature
            });
    }

    async signatureForBlockHeight({
        accountId,
        blockHeight,
        valid = true,
    }) {
        const blockNumber = String(valid ? blockHeight : blockHeight - 101);
        const message = Buffer.from(blockNumber);

        const signedHash = await this._signer.signMessage(message, accountId);
        const blockNumberSignature = Buffer.from(signedHash.signature).toString('base64');

        return { blockNumber, blockNumberSignature };
    }

    buildTestAccountId() {
        return `helper-test-${uuid.v4()}`;
    }

    async createNEARAccount(requestedAccountId) {
        const newAccountId = requestedAccountId ? requestedAccountId : this.buildTestAccountId();

        await this._request.post('/account')
            .send({
                newAccountId,
                newAccountPublicKey: this.publicKey
            });

        // Register the new keypair with our keystore so that our NEAR Client instance knows about it
        await this._keyStore.setKey(undefined, newAccountId, this._keyPair);

        return newAccountId;
    }

    async create2faEnabledNEARAccount({
        requestedAccountId,
        method,
        bypassEndpointCreation,
    }) {
        const accountId = await this.createNEARAccount(requestedAccountId);
        const { securityCode } = await this.init2faMethod({ accountId, method, bypassEndpointCreation });

        return { accountId, securityCode };
    }
}

module.exports = TestAccountHelper;
