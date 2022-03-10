const { updateDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function updateIdentityVerificationMethod({ uniqueIdentityKey }, attrs) {
    return updateDocument(IdentityVerificationMethod, {
        uniqueIdentityKey,
        ...attrs,
    });
}

module.exports = updateIdentityVerificationMethod;
