const fs = require('fs');
const path = require('path');

const { expect } = require('../chai');

module.exports = function validateAcceptanceTestContent({
    forceUpdateAcceptanceTestContent,
    output: {directory, filename},
    newMessageContent
}) {
    if(!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    if (forceUpdateAcceptanceTestContent) {
        console.warn('Updating acceptance test message content: ' + filename);
        fs.writeFileSync(
            path.join(directory, filename),
            newMessageContent,
            { encoding: 'UTF-8' }
        );
    } else {
        let existingMessageContent;
        try {
            existingMessageContent = fs.readFileSync(
                path.join(directory, filename),
                { encoding: 'UTF-8' }
            );
        } catch (e) {
            console.log(`initializing new acceptance test file: ${filename}`);
            fs.writeFileSync(
                path.join(directory, filename),
                newMessageContent,
                { encoding: 'UTF-8' }
            );
            existingMessageContent = newMessageContent;
        }

        expect(newMessageContent).equal(
            existingMessageContent,
            'If you have intentionally changed the message content and your changes look good, ' +
            'set "forceUpdateAcceptanceTestContent" to true and re-run this test to update the acceptance test file: ' +
            filename
        );
    }
};