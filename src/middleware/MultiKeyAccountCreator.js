const debug = require('debug');
const {
    ErrorContext,
    JsonRpcProvider,
    KeyPairSigner,
    PublicKey,
    TypedError,
    actions: {
        addFullAccessKey,
        createAccount: createAccountAction,
        transfer,
    },
    baseDecode,
    baseEncode,
    createTransaction,
} = require('near-api-js');
const { InvalidNonceError } = require('near-api-js/rpc-errors');

const { parseKeyPair } = require('./near');
const withRetry = require('../utils/withExponentialJitterRetries');

class MultiKeyAccountCreator {
    constructor({
        sourceAccount: {
            accountId,
            signingPrivKeys,
        },
    }) {
        this.initialized = false;

        this.debugLog = debug('MultiKeyAccountCreator');
        this.sourceAccountId = accountId;
        this.signingKeys = signingPrivKeys.map((privKey) => parseKeyPair(privKey));
        this.nextKeypairGenerator = this.createNextKeypairGenerator();
    }

    async initialize() {
        this.debugLog('initializing');

        this.provider = new JsonRpcProvider({ url: process.env.NODE_URL });

        this.initialized = true;
    }

    async signTransaction({ receiverId, actions, keyPair }) {
        this.debugLog('signTransaction', { receiverId, actions });
        const publicKey = keyPair.getPublicKey();

        const accessKeyInfo = await this.provider.viewAccessKey({
            accountId: this.sourceAccountId,
            publicKey,
            finalityQuery: { finality: 'optimistic' },
        });

        if (!accessKeyInfo) {
            throw new Error(`Could not find access key ${publicKey}`);
        }

        const block = await this.provider.viewBlock({ finality: 'final' });

        this.debugLog('signTransaction', { block, accessKeyInfo });

        const transaction = createTransaction(
            this.sourceAccountId,
            publicKey,
            receiverId,
            accessKeyInfo.nonce + BigInt(1),
            actions,
            baseDecode(block.header.hash)
        );

        const { txHash, signedTransaction } = await new KeyPairSigner(keyPair).signTransaction(transaction);

        this.debugLog('signTransaction', { txHash, signedTransaction });

        return { txHash, signedTx: signedTransaction };
    }

    async signAndSendTransaction({ receiverId, actions, keyPair }) {
        const { signedTx, txHash } = await this.signTransaction({ receiverId, actions, keyPair });

        this.debugLog('signAndSendTransaction', 'sending transaction', signedTx);

        try {
            return await this.provider.sendTransaction(signedTx);
        } catch (err) {
            err.context = new ErrorContext(baseEncode(txHash));
            throw err;
        }
    }

    async sendCreateAccountRequest({ accountId, publicKey, keyPair, amount }) {
        this.debugLog('sendCreateAccountRequest', {
            accountId,
            publicKey: publicKey.toString(),
            signingKey: keyPair.getPublicKey().toString(),
            amount
        });

        return this.signAndSendTransaction({
            receiverId: accountId,
            actions: [
                createAccountAction(),
                transfer(BigInt(amount)),
                addFullAccessKey(PublicKey.from(publicKey))
            ],
            keyPair
        });
    }

    * createNextKeypairGenerator() {
        let keyIndex = -1;

        while (true) {
            keyIndex = keyIndex + 1 === this.signingKeys.length ? 0 : keyIndex + 1;

            yield this.signingKeys[keyIndex];
        }
    }

    get nextKeypair() {
        const keyPair = this.nextKeypairGenerator.next().value;
        this.debugLog('nextKeypair', { publicKey: keyPair.getPublicKey().toString() });
        return keyPair;
    }

    async createAccount({ accountId, publicKey, amount }) {
        let result;
        try {
            result = await withRetry(
                async () => this.sendCreateAccountRequest({
                    accountId,
                    amount,
                    keyPair: this.nextKeypair,
                    publicKey,
                }),
                {}
            );
        } catch (err) {
            if (err instanceof InvalidNonceError) {
                throw new TypedError('nonce retries exceeded for transaction. This usually means there are too many parallel requests with the same access key.', 'RetriesExceeded');
            }

            throw err;
        }

        return result;
    }
}

module.exports = MultiKeyAccountCreator;
