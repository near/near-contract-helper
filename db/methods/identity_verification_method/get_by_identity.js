const { getDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function getIdentityVerificationMethodByIdentity(identityKey) {
    return getDocument(IdentityVerificationMethod, {
        identityKey,
    });
}

module.exports = getIdentityVerificationMethodByIdentity;
