const chai = require('./chai');

const { expect } = chai;

function expectJSONResponse(res) {
    try {
        expect(res)
            .property('statusCode', 200);
    } catch (e) {
        // Print the text returned by the API
        expect(res).property('text').equal(undefined, `Expected 200 statusCode, got ${res.statusCode}`);
    }

    expect(res)
        .nested
        .property('header.content-type')
        .contains('application/json');

    return res;
}

function expectFailedWithCode(code, message) {
    return (res) => {
        expect(res)
            .property('statusCode', code);
        expect(res).property('text', message);
    };
}


module.exports = {
    expectJSONResponse,
    expectFailedWithCode
};