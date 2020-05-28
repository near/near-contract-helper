
const sendMail = async (options) => {
    if (process.env.NODE_ENV == 'production') {
        const nodemailer = require('nodemailer');
        const transport = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD
            }
        });
        return transport.sendMail({
            from: 'wallet@nearprotocol.com',
            ...options
        });
    } else {
        console.log('sendMail:', options);
    }
};
module.exports = {
    sendMail
};