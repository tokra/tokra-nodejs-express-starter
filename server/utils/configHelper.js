const _ = require('lodash');
const { ObjectUtils, BooleanUtils, isNumber } = require('./typesHelper');

const isEnabledInConfig = (configObj, nameOfSubObject, nameOfProperty) => {
	if (ObjectUtils.hasProperty(configObj, nameOfSubObject)) {
		/* istanbul ignore else */
		if (ObjectUtils.hasProperty(configObj[nameOfSubObject], nameOfProperty)) {
			const value = configObj[nameOfSubObject][nameOfProperty];
			/* istanbul ignore else */
			if (BooleanUtils.isBoolean(value)) {
				return BooleanUtils.getBoolean(value);
			}
		}
	}
	return false;
};

const getAsNumber = (configObj, nameOfProperty) => {
	if (_.has(configObj, nameOfProperty)) {
		if (isNumber(configObj[nameOfProperty])) {
			return _.toNumber(configObj[nameOfProperty]);
		}
	}
	return -1;
};

module.exports = {
	isEnabledInConfig,
	getAsNumber
};
