const bs58 = require('bs58');
const { sha256 } = require('js-sha256');
const nearAPI = require('near-api-js');
const debug = require('debug');
const withRetry = require('../utils/withExponentialJitterRetries');

const {
    transactions: {
        addKey: addKeyAction,
        createAccount: createAccountAction,
        transfer: transferAction,
        fullAccessKey,
        SignedTransaction,
        Transaction,
        Signature
    },
    KeyPair,
    utils: {
        PublicKey
    },
    providers: {
        TypedError,
        ErrorContext
    }
} = nearAPI;

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
        this.signingKeys = signingPrivKeys.map((privKey) => KeyPair.fromString(privKey));
        this.nextKeypairGenerator = this.createNextKeypairGenerator();
    }

    async initialize() {
        this.debugLog('initializing');

        this.near = await nearAPI.connect({
            deps: {
                keyStore: {
                    async getKey() {
                        return nearAPI.KeyPair.fromString('bs');
                    },
                }
            },
            nodeUrl: process.env.NODE_URL
        });

        this.initialized = true;
    }

    getSignedTransactionObject(transactionObj, keyPair) {
        this.debugLog('getSignedTransactionObject');
        const message = transactionObj.encode();
        const txHash = new Uint8Array(sha256.sha256.array(message));
        const { signature } = keyPair.sign(txHash);

        const signedTx = new SignedTransaction({
            transaction: transactionObj,
            signature: new Signature({
                keyType: transactionObj.publicKey.keyType,
                data: signature
            })
        });

        this.debugLog('getSignedTransactionObject', { txHash, signedTx });

        return { txHash, signedTx };
    }

    async signTransaction({ receiverId, actions, keyPair }) {
        this.debugLog('signTransaction', { receiverId, actions });
        const publicKey = keyPair.getPublicKey().toString();

        const accessKeyInfo = await this.near.connection.provider.query({
            request_type: 'view_access_key',
            account_id: this.sourceAccountId,
            public_key: publicKey,
            finality: 'optimistic'
        });

        if (!accessKeyInfo) {
            throw new Error(`Could not find access key ${publicKey}`);
        }

        const block = await this.near.connection.provider.block({ finality: 'final' });

        this.debugLog('signTransaction', { block, accessKeyInfo });

        const transactionObj = new Transaction({
            signerId: this.sourceAccountId,
            receiverId,
            publicKey: keyPair.getPublicKey(),
            nonce: accessKeyInfo.nonce + 1,
            actions,
            blockHash: Buffer.from(bs58.decode(block.header.hash))
        });

        return this.getSignedTransactionObject(transactionObj, keyPair);
    }

    async signAndSendTransaction({ receiverId, actions, keyPair }) {
        const { signedTx, txHash } = await this.signTransaction({ receiverId, actions, keyPair });

        this.debugLog('signAndSendTransaction', 'sending transaction', signedTx);

        try {
            return await this.near.connection.provider.sendTransaction(signedTx);
        } catch (err) {
            err.context = new ErrorContext(Buffer.from(bs58.encode(txHash)));
            throw err;
        }
    }

    async sendCreateAccountRequest({ accountId, publicKey, keyPair, amount }) {
        this.debugLog('sendCreateAccountRequest', {
            accountId,
            publicKey,
            signingKey: keyPair.getPublicKey().toString(),
            amount
        });

        return this.signAndSendTransaction({
            receiverId: accountId,
            actions: [
                createAccountAction(),
                transferAction(amount),
                addKeyAction(PublicKey.from(publicKey), fullAccessKey())
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
            if (err.type === 'InvalidNonce') {
                throw new TypedError('nonce retries exceeded for transaction. This usually means there are too many parallel requests with the same access key.', 'RetriesExceeded');
            }

            throw err;
        }

        return result;
    }
}

module.exports = MultiKeyAccountCreator;