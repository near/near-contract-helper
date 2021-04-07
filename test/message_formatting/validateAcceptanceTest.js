const path = require('path');
const fs = require('fs');
const { expect } = require('../chai');

module.exports = function validateAcceptanceTestContent({
    forceUpdateOfExistingSample,
    samplePathSegments,
    newMessageContent
}) {
    const relativePathDisplayStr = path.join(...samplePathSegments);
    if (forceUpdateOfExistingSample) {
        console.warn('Updating sample message content for "Verify 2FA Method": ' + relativePathDisplayStr);
        fs.writeFileSync(
            path.resolve(__dirname, 'samples', ...samplePathSegments),
            newMessageContent,
            { encoding: 'UTF-8' }
        );
    } else {
        let existingMessageContent;
        try {
            existingMessageContent = fs.readFileSync(
                path.resolve(__dirname, 'samples', ...samplePathSegments),
                { encoding: 'UTF-8' }
            );
        } catch (e) {
            console.log(`initializing new sample file: ${relativePathDisplayStr}`);
            fs.writeFileSync(
                path.resolve(__dirname, 'samples', ...samplePathSegments),
                newMessageContent,
                { encoding: 'UTF-8' }
            );
            existingMessageContent = newMessageContent;
        }

        expect(newMessageContent).equal(
            existingMessageContent,
            'If you have intentionally changed the message content and your changes look good, ' +
            'set "forceUpdateOfExistingSample" to true and re-run this test to update the sample file: ' +
            relativePathDisplayStr
        );
    }
};