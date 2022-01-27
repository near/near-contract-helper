const { updateDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function updateIdentityVerificationMethod({ identityKey, kind }, attrs) {
    return updateDocument(IdentityVerificationMethod, {
        identityKey,
        kind,
        ...attrs,
    });
}

module.exports = updateIdentityVerificationMethod;
