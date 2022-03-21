const supertest = require('supertest');

const app = require('../app');
const twilioVerifyMock = require('./mocks/twilio_verify');

// TODO: Inject services / service methods for route binding here rather than having them hard coded in `app.js`
function createTestServerInstance() {
    // override existing services with mocks
    app.context.services = {
        twilioVerify: new twilioVerifyMock(),
    };

    const request = supertest(app.callback());
    return { app, request };
}

module.exports = createTestServerInstance;