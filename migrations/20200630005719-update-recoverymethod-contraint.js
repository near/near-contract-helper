'use strict';

module.exports = {
	up: (queryInterface) => {
		return queryInterface.removeConstraint(
			'RecoveryMethods',
			'kind_constraint',
		).then(() => queryInterface.addConstraint(
			'RecoveryMethods',
			['kind'],
			{
				name: 'kind_constraint',
				type: 'check',
				where: {
					kind: ['email', 'phone', 'phrase', '2fa-email', '2fa-phone']
				}
			},
		))
	},

	down: (queryInterface) => {
		return queryInterface.removeConstraint(
			'RecoveryMethods',
			'kind_constraint',
		).then(() => queryInterface.addConstraint(
			'RecoveryMethods',
			['kind'],
			{
				name: 'kind_constraint',
				type: 'check',
				where: {
					kind: ['email', 'phone', 'phrase']
				}
			},
		))
	}
};
