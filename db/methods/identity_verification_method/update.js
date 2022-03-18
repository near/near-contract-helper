const { updateDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function updateIdentityVerificationMethod({ uniqueIdentityKey }, { claimed, identityKey, kind, securityCode }) {
    return updateDocument(IdentityVerificationMethod, {
        uniqueIdentityKey,
        claimed,
        identityKey,
        kind,
        securityCode,
    });
}

module.exports = updateIdentityVerificationMethod;
