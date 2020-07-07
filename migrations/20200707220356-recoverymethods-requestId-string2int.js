'use strict';

module.exports = {
	up: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('RecoveryMethods', 'requestId')
      .then(() => queryInterface.addColumn('RecoveryMethods', 'requestId', Sequelize.INTEGER
    ));
	},

	down: (queryInterface, Sequelize) => {
		return queryInterface.removeColumn('RecoveryMethods', 'requestId')
      .then(() => queryInterface.addColumn('RecoveryMethods', 'requestId', Sequelize.STRING
    ));
	}
};
