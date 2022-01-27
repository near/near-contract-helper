const crypto = require('crypto');

const signParams = async ctx => {
    const { 
        toCurrency,
        toWallet,} = ctx.query;

    
    if (!toWallet || !toCurrency) {
        ctx.throw(400);
    }

    const params = { toCurrency,  toWallet };

    const signature = crypto
        .createHmac('sha256', process.env.NEARPAY_SECRET_KEY)
        .update(Object.keys(params).sort().map(key => `${key}:${params[key]}`).join(''))
        .digest('hex');

    ctx.body = {
        signature
    };
};

module.exports = { signParams };
