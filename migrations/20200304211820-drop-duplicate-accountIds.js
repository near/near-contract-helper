'use strict';

module.exports = {
    up: queryInterface => {
        return queryInterface.sequelize.query(`
            DELETE  FROM
                "Accounts" a
                    USING "Accounts" b
            WHERE
                a."updatedAt" < b."updatedAt"
                AND a."accountId" = b."accountId";
        `);
    },

    down: () => {
        return 'cool';
    }
};
