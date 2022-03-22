const supertest = require('supertest');

const app = require('../app');

// TODO: Inject services / service methods for route binding here rather than having them hard coded in `app.js`
function createTestServerInstance() {
    const request = supertest(app.callback());
    return { app, request };
}

module.exports = createTestServerInstance;