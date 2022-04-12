const MockTwilioVerifyService = require('./mock_twilio_verify');
const TwilioVerifyService = require('./twilio_verify');

const USE_MOCK_TWILIO = process.env.USE_MOCK_TWILIO === 'true';

module.exports = USE_MOCK_TWILIO ? MockTwilioVerifyService : TwilioVerifyService;
