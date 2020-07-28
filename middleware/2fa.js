const nearAPI = require('near-api-js');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { creatorKeyJson } = require('./near');
const { sendSms } = require('../utils/sms');
const { sendMail } = require('../utils/email');
const models = require('../models');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const password = require('secure-random-password');
const SECURITY_CODE_DIGITS = 6;
const twoFactorMethods = ['2fa-email', '2fa-phone'];
const viewMethods = [];
const changeMethods = ['confirm'];

const getContract = async (contractName, secretKey) => {
    const keyStore = {
        async getKey() {
            return nearAPI.KeyPair.fromString(secretKey);
        },
    };
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson && creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
    const contractAccount = new nearAPI.Account(near.connection, contractName);
    const contract = new nearAPI.Contract(contractAccount, contractName, {
        viewMethods,
        changeMethods,
    });
    return contract;
};
const confirmRequest = async (accountId, request_id) => {
    const key = await getDetermKey(accountId);
    const contract = await getContract(accountId, key.secretKey);
    // always parseInt on requestId. requestId is string in db because it could come from url params etc...
    const res = await contract.confirm({ request_id: parseInt(request_id) }).catch((e) => {
        return { success: false, error: e };
    });
    return { success: !!res, res };
};
/********************************
2FA Key
********************************/
// helper: generates a deterministic key based on the accountId
const getDetermKey = async (accountId) => {
    const hash = crypto.createHash('sha256').update(accountId + creatorKeyJson.private_key).digest();
    const keyPair = nacl.sign.keyPair.fromSeed(hash);//nacl.sign.keyPair.fromSecretKey(hash)
    return {
        publicKey: `ed25519:${nearAPI.utils.serialize.base_encode(keyPair.publicKey)}`,
        secretKey: nearAPI.utils.serialize.base_encode(keyPair.secretKey)
    };
};
/********************************
Sending Codes
method.kind = ['2fa-email', '2fa-phone']
********************************/
const prettyRequestInfo = ({ request }) => `
    Transaction Recipient: ${ request.receiver_id }
    Actions:\n\t${ request.actions.map((r) => r.type + (r.amount ? ': ' + nearAPI.utils.format.formatNearAmount(r.amount, 4) : '')).join('\n\t') }
`;

const sendCode = async (method, twoFactorMethod, requestId = -1, data = {}) => {
    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
    await twoFactorMethod.update({ securityCode, requestId });
    const dataOutput = data.request ? prettyRequestInfo(data) : `Verifying ${method.detail} as 2FA method`;
    const text = 
`
NEAR Wallet security code: ${securityCode}\n\n
Important: By entering this code, you are authorizing the following transaction:\n\n
${dataOutput}
`;
    const html =
`
<body style="margin: 0; padding: 0;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center">
                <img src="https://near.org/wp-content/themes/near-19/assets/downloads/near_logo.png" width="300" height="117"
            </td>
        </tr>
        <tr>
            <td>
                <p>NEAR Wallet security code: ${securityCode}</p>
                <p><strong>Important:</strong> By entering this code, you are authorizing the following transaction:\n\n</p>
                <pre>
                    ${dataOutput}
                </pre>
            </td>
        </tr>
    </table>
</body>
`;
    if (method.kind === '2fa-phone') {
        await sendSms({
            text,
            to: method.detail
        });
    } else if (method.kind === '2fa-email') {
        await sendMail({
            to: method.detail,
            subject: `NEAR Wallet security code: ${securityCode}`,
            text,
            html
        });
    }
    return securityCode;
};

/********************************
Checking code_hash (is multisig deployed)
********************************/
const isContractDeployed = async(accountId) => {
    const keyStore = {
        async getKey() {
            return nearAPI.KeyPair.fromString('bs');
        },
    };
    // check account code_hash
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson && creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
    const nearAccount = new nearAPI.Account(near.connection, accountId);
    const state = await nearAccount.state();
    console.log(state);
    return state.code_hash !== '11111111111111111111111111111111';
};

/********************************
@warn protect these routes using checkAccountOwnership middleware from app.js
@warn Requires refactor
********************************/
// http post http://localhost:3000/2fa/getAccessKey accountId=mattlock
// http post https://helper.testnet.near.org/2fa/getAccessKey accountId=mattlock
// http post https://near-contract-helper-2fa.onrender.com/2fa/getAccessKey accountId=mattlock
// Call this to get the public key of the access key that contract-helper will be using to confirm multisig requests
const getAccessKey = async (ctx) => {
    const { accountId } = ctx.request.body;
    const { publicKey } = await getDetermKey(accountId);
    ctx.body = {
        success: true,
        publicKey
    };
};
// https://near-contract-helper-2fa.onrender.com/
// http post http://localhost:3000/2fa/init accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// http post https://near-contract-helper-2fa.onrender.com/2fa/init accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// Call ONCE to enable 2fa on this account. Adds a twoFactorMethod (passed in body) where kind should start with '2fa-'
// This WILL send the initial code to the method specified ['2fa-email', '2fa-phone']
const initCode = async (ctx) => {
    const { accountId, method, testing, code_hash } = ctx.request.body;
    const [account] = await models.Account.findOrCreate({ where: { accountId } });
    if (!account) {
        ctx.throw(401, 'account should be created');
        return;
    }
    if (!method || !method.kind || !method.detail) {
        ctx.throw(401, 'method arguments invalid');
        return;
    }
    const { kind, detail } = method;
    // validate method kind
    if (!twoFactorMethods.includes(kind)) {
        ctx.throw(401, 'invalid 2fa method ' + kind);
        return;
    }
    const hasContractDeployed = await isContractDeployed(accountId);
    // check recover methods
    let [twoFactorMethod] = await account.getRecoveryMethods({ where: {
        kind: {
            [Op.startsWith]: '2fa-'
        },
    }});
    // check if multisig contract is already deployed
    if (hasContractDeployed || !!code_hash) {
        // check to see if they already have at least 1 twoFactorMethod
        if (twoFactorMethod) {
            ctx.throw(401, 'account with multisig contract already has 2fa method');
        } else {
            // unlikely
            twoFactorMethod = await account.createRecoveryMethod({ kind, detail, requestId: -1 });
        }
    } else {
        // as long as the multisig is not deployed, can keep updating (or create new, 2fa method)
        if (!twoFactorMethod) {
            twoFactorMethod = await account.createRecoveryMethod({ kind, detail, requestId: -1 });
        } else {
            await twoFactorMethod.update({
                kind: method.kind,
                detail: method.detail,
                requestId: -1
            });
        }
    }
    // check if 2fa method matches existing recovery method
    const [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: kind.split('2fa-')[1],
        detail,
    }});
    if (!recoveryMethod) {
        // client waits to deploy contract until code is verified
        const securityCode = await sendCode(method, twoFactorMethod);
        const body = {
            success: true,
            message: '2fa initialized and code sent to verify method',
        };
        if (testing) {
            body.securityCode = securityCode;
        }
        ctx.body = body;
    } else {
        // client should deploy contract
        ctx.body = {
            success: true, confirmed: true, message: '2fa initialized and set up using recovery method verification'
        };
    }
};
// http post http://localhost:3000/2fa/send accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// http post https://near-contract-helper-2fa.onrender.com/2fa/send accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// Call anytime after calling initCode to resend a new code, the new code will overwrite the old code
const sendNewCode = async (ctx) => {
    const { accountId, method, requestId, data } = ctx.request.body;
    const [account] = await models.Account.findOrCreate({ where: { accountId } });
    if (!account) {
        console.warn('account should be created');
        ctx.throw(401);
    }
    let [twoFactorMethod] = await account.getRecoveryMethods({ where: {
        kind: {
            [Op.startsWith]: '2fa-'
        },
    }});
    if (!twoFactorMethod) {
        console.warn('2fa not enabled');
        ctx.throw(401);
    }

    await sendCode(method, twoFactorMethod, requestId, data);
    ctx.body = {
        success: true, message: '2fa code sent'
    };
};
// http post http://localhost:3000/2fa/verify accountId=mattlock securityCode=430888
// http post https://near-contract-helper-2fa.onrender.com/2fa/verify accountId=mattlock securityCode=437543
// call when you want to verify the "current" securityCode
const verifyCode = async (ctx) => {
    const { accountId, securityCode, requestId, testing } = ctx.request.body;
    const account = await models.Account.findOne({ where: { accountId } });
    const [twoFactorMethod] = await account.getRecoveryMethods({ where: {
        securityCode,
        kind: {
            [Op.startsWith]: '2fa-'
        },
        // only verify codes that are 5 minutes old (if testing make this impossible)
        updatedAt: {
            [Op.gt]: Date.now() - (!testing ? 300000 : -1000)
        }
        // cannot test for requestId equality with negative integer???
    }});
    // checking requestId here with weak equality (no type match)
    if (!twoFactorMethod || twoFactorMethod.requestId != requestId) {
        console.warn('2fa code invalid');
        ctx.throw(401);
    }
    //security code was valid, remove it and if there was a request, confirm it, otherwise just return success: true
    await twoFactorMethod.update({ requestId: -1, securityCode: null });
    // requestId already matched twoFactorMethod record and if it's not -1 we will attempt to confirm the request
    if (requestId !== -1) {
        ctx.body = await confirmRequest(accountId, parseInt(requestId));
    } else {
        ctx.body = {
            success: true, message: '2fa code verified', requestId: twoFactorMethod.requestId,
        };
    }
};

module.exports = {
    getAccessKey,
    initCode,
    sendNewCode,
    verifyCode,
};


