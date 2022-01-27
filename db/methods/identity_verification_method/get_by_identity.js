const { getDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function getIdentityVerificationMethodByIdentity(identityKey, kind) {
    return getDocument(IdentityVerificationMethod, {
        identityKey,
        kind
    });
}

module.exports = getIdentityVerificationMethodByIdentity;
