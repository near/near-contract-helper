

const sendcode = async ctx => {
    const { tx } = ctx.request.body;
    ctx.body = { tx }
}

module.exports = {
    sendcode
}
