const FiatValueManager = require('../FiatValueManager');

module.exports = function createFiatValueMiddleware() {
    const fiatValueManager = new FiatValueManager();

    return async function fiatValue(ctx) {
        ctx.body = await fiatValueManager.getPrice(['near']);
    };
};