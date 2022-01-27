const getIdentityVerificationMethod = require('./get_by_identity');
const getIdentityVerificationMethodByUniqueKey = require('./get_by_unique_identity_key');
const updateIdentityVerificationMethod = require('./update');

module.exports = {
    getIdentityVerificationMethod,
    getIdentityVerificationMethodByUniqueKey,
    updateIdentityVerificationMethod,
};
