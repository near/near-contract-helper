const Environments = require('./environments.json');
const FeatureFlags = require('./flags.json');

function initFeatureFlags({ flagState, currentEnvironment, environments }) {
    if (typeof flagState !== 'object') {
        throw Error('invalid flags');
    }

    if (!Object.values(environments).includes(currentEnvironment)) {
        throw Error(`invalid environment: "${currentEnvironment}"`);
    }

    return new Proxy(flagState, {
        get(flags, flag) {
            if (flag === '__esModule') {
                return { value: true };
            }

            const feature = flags[flag];
            if (!feature) {
                throw Error(`invalid feature: "${flag}"`);
            }

            if (!feature[currentEnvironment]) {
                throw Error(`${flag} missing definition for environment: "${currentEnvironment}"`);
            }

            return feature[currentEnvironment].enabled;
        },
    });
}

const Features = initFeatureFlags({
    flagState: FeatureFlags,
    currentEnvironment: process.env.NEAR_WALLET_ENV,
    environments: Environments,
});

module.exports = { Features };
