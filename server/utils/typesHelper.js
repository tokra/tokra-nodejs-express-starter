const _ = require('lodash');

class ObjectUtils {
	static hasProperty(obj = {}, propKey = '') {
		return _.has(obj, propKey);
	}

	static copyObject(object) {
		return _.cloneDeep(object);
	}
}

class BooleanUtils {
	static isBoolean(arg) {
		return [true, false, 'true', 'false'].includes(arg);
	}

	static getBoolean(arg) {
		return this.isBoolean(arg) ? arg === true || arg === 'true' : undefined;
	}
}

const isString = variable => typeof variable === 'string';

const isNumber = num => {
	if (_.isString(num)) {
		const result = _.toNumber(num);
		return !_.isNaN(result) && _.isNumber(result);
	}
	return _.isNumber(num);
};

module.exports = {
	ObjectUtils,
	BooleanUtils,
	isString,
	isNumber
};
