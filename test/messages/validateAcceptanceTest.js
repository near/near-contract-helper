const fs = require('fs');
const { expect } = require('../chai');

module.exports = function validateAcceptanceTestContent({
    forceUpdateOfExistingSample,
    filePathRelative,
    newMessageContent
}) {
    if (forceUpdateOfExistingSample) {
        console.warn('Updating acceptance test message content: ' + filePathRelative);
        fs.writeFileSync(
            filePathRelative,
            newMessageContent,
            { encoding: 'UTF-8' }
        );
    } else {
        let existingMessageContent;
        try {
            existingMessageContent = fs.readFileSync(
                filePathRelative,
                { encoding: 'UTF-8' }
            );
        } catch (e) {
            console.log(`initializing new acceptance test file: ${filePathRelative}`);
            fs.writeFileSync(
                filePathRelative,
                newMessageContent,
                { encoding: 'UTF-8' }
            );
            existingMessageContent = newMessageContent;
        }

        expect(newMessageContent).equal(
            existingMessageContent,
            'If you have intentionally changed the message content and your changes look good, ' +
            'set "forceUpdateOfExistingSample" to true and re-run this test to update the acceptance test file: ' +
            filePathRelative
        );
    }
};