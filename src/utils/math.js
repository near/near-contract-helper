const modulo = (a, b) => {
    const r = a % b;

    // If r and b differ in sign, add b to wrap the result to the correct sign.
    return (r * b < 0) ? r + b : r;
};

module.exports = {
    modulo,
};
