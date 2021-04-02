const nearAPI = require('near-api-js');

class TestAccountHelper {
    constructor({ keyPair, keyStore, request }) {
        this._keyPair = keyPair;
        this._keyStore = keyStore;
        this._request = request;

        this._signer = new nearAPI.InMemorySigner(this._keyStore);
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

    async initRecoveryMethodForTempAccount({ accountId, method }) {
        const result = await this._request.post('/account/initializeRecoveryMethodForTempAccount')
            .send({
                accountId,
                method,
            });

        return result;
    }

    async initRecoveryMethod({ accountId, method, testing, valid }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        const result = await this._request.post('/account/initializeRecoveryMethod')
            .send({
                accountId,
                method,
                testing,
                ...signature,
            });

        return result;
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

    async init2faMethod({ accountId, method, valid, testContractDeployed }) {
        const signature = await this.signatureForLatestBlock({ accountId, valid });

        const result = await this._request
            .post('/2fa/init')
            .send({ accountId, method, testContractDeployed, ...signature });

        return result;
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
        return `helper-test-${Date.now()}`;
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
    }) {
        const accountId = await this.createNEARAccount(requestedAccountId);
        await this.init2faMethod({ accountId, method });

        return accountId;
    }
}

module.exports = TestAccountHelper;