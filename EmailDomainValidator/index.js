const BlockTempEmailClient = require('./BlockTempEmailClient');
const EmailDomainValidator = require('./EmailDomainValidator');
const EmailDomainBlacklistDBClient = require('./EmailDomainBlacklistDBClient');

const { BLOCK_TEMP_EMAIL_API_KEY } = process.env;

function createEmailDomainValidator() {
    const emailDomainValidator = new EmailDomainValidator({
        blockTempEmailClient: new BlockTempEmailClient({ API_KEY: BLOCK_TEMP_EMAIL_API_KEY, }),
        emailDomainBlacklistDbClient: new EmailDomainBlacklistDBClient({})
    });

    return emailDomainValidator;
}

module.exports = createEmailDomainValidator;