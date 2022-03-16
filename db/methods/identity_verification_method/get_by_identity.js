const { getDocument } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function getIdentityVerificationMethodByIdentity(uniqueIdentityKey) {
    return getDocument(IdentityVerificationMethod, {
        uniqueIdentityKey,
    });
}

module.exports = getIdentityVerificationMethodByIdentity;
