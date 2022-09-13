const { modulo } = require('../src/utils/math');
const chai = require('./chai');

const { expect } = chai;

describe('src/utils/math', function () {
    it('modulo', () => {
        expect(modulo(0, 3)).to.equal(0);
        expect(modulo(1, 3)).to.equal(1);
        expect(modulo(2, 3)).to.equal(2);

        expect(modulo(3, 3)).to.equal(0);
        expect(modulo(4, 3)).to.equal(1);
        expect(modulo(5, 3)).to.equal(2);
    });
});
