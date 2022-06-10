const Sentry = require('@sentry/node');
const {
    extractTraceparentData,
    stripUrlQueryAndFragment
} = require('@sentry/tracing');

function setupErrorHandler(app, dsn) {
    const Sentry = require('@sentry/node');
    Sentry.init({
        dsn,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
        ],

        // TODO: Adjust Sentry sampling rate in production
        tracesSampleRate: 1.0,
    });
    app.on('error', (err, ctx) => {
        Sentry.withScope(function (scope) {
            scope.addEventProcessor(function (event) {
                return Sentry.Handlers.parseRequest(event, ctx.request);
            });
            Sentry.captureException(err);
        });
    });
}

// NOTE: Code taken from https://docs.sentry.io/platforms/node/guides/koa/#monitor-performance

// not mandatory, but adding domains does help a lot with breadcrumbs
const requestHandler = async (ctx, next) => {
    // TODO: Figure out whether need both this and onError parseRequest
    Sentry.getCurrentHub().configureScope(scope =>
        scope.addEventProcessor(event =>
            Sentry.Handlers.parseRequest(event, ctx.request, { user: false })
        )
    );
    await next();
};

// this tracing middleware creates a transaction per request
const tracingMiddleware = async (ctx, next) => {
    const reqMethod = (ctx.method || '').toUpperCase();
    const reqUrl = ctx.url && stripUrlQueryAndFragment(ctx.url);

    // connect to trace of upstream app
    let traceparentData;
    if (ctx.request.get('sentry-trace')) {
        traceparentData = extractTraceparentData(ctx.request.get('sentry-trace'));
    }

    const transaction = Sentry.startTransaction({
        name: `${reqMethod} ${reqUrl}`,
        op: 'http.server',
        ...traceparentData,
    });

    ctx.__sentry_transaction = transaction;
    await next();

    // if using koa router, a nicer way to capture transaction using the matched route
    if (ctx._matchedRoute) {
        const mountPath = ctx.mountPath || '';
        transaction.setName(`${reqMethod} ${mountPath}${ctx._matchedRoute}`);
    }
    transaction.setHttpStatus(ctx.status);
    transaction.finish();
};

const captureException = (e) => {
    Sentry.captureException(e);
};

module.exports = {
    setupErrorHandler,
    requestHandler,
    tracingMiddleware,
    captureException
};