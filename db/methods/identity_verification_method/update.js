const { updateDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function updateIdentityVerificationMethod({ identityKey }, attrs) {
    return updateDocument(IdentityVerificationMethod, {
        identityKey,
        ...attrs,
    });
}

module.exports = updateIdentityVerificationMethod;
