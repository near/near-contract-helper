const { listDocuments } = require('../../dynamo');
const IdentityVerificationMethod = require('../../schemas/identity_verification_method');

function getIdentityVerificationMethodByUniqueIdentityKey(uniqueIdentityKey) {
    // NB this is guaranteed to return one document so long as uniqueIdentityKey properties
    // on identity verification method documents deterministically map N:1 onto identityKey
    return listDocuments(IdentityVerificationMethod, {
        hashKey: uniqueIdentityKey,
        index: 'identity_verification_method_unique_identity_key',
    }).get(0);
}

module.exports = getIdentityVerificationMethodByUniqueIdentityKey;
