'use strict';

module.exports = {
	up: (queryInterface, Sequelize) => {
		return queryInterface.addColumn('RecoveryMethods', 'requestId', Sequelize.STRING);
	},

	down: (queryInterface, Sequelize) => {
		return queryInterface.removeColumn('RecoveryMethods', 'requestId');
	}
};
