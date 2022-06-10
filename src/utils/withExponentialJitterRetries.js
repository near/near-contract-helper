'use strict';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelay(options) {
    let {
        attemptNumber,
        initialDelay = 1000,
        maxDelay = 2000
    } = options;

    return Math.random() * Math.min(
        (2 ** attemptNumber * initialDelay),
        maxDelay
    );
}

async function withRetries(actionFunc, options = {}) {
    const { maxRetries = 30 } = options;

    for (let attemptNumber = 1; attemptNumber < maxRetries; attemptNumber += 1) {
        let result;
        try {
            result = await actionFunc();

        } catch (e) {
            if (attemptNumber === maxRetries - 1) {
                throw e;
            }
        }

        if (result !== undefined) {
            return result;
        }

        await delay(getRetryDelay({ attemptNumber }));
    }


}

module.exports = withRetries;