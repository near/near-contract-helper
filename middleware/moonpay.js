const crypto = require('crypto');

const signURL = async ctx => {
    const { url } = ctx.query;
    if (!url) {
        ctx.throw(400);
    }

    const signature = crypto
        .createHmac('sha256', process.env.MOONPAY_SECRET_KEY)
        .update(new URL(url).search)
        .digest('base64');

    // TODO: Any validation for the signed URL

    ctx.body = {
        url,
        signature
    };
};

module.exports = { signURL };