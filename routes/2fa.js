
/********************************
1. User sends tx in body
2. Create a code to confirm
3. SMS them the code
4. Send response "code sent"

Try this from the wallet side and make sure it works end to end
********************************/

const { sendSms } = require('./../providers/sms');

console.log(sendSms);

const sendcode = async ctx => {
    const { tx } = ctx.request.body;
    ctx.body = { tx };
};

module.exports = {
    sendcode
};
