/** ******************************************************** {COPYRIGHT-TOP} ****
 * Licensed Materials - Property of IBM
 *
 * (C) Copyright IBM Corp. 2015,2016 All Rights Reserved
 *
 * US Government Users Restricted Rights - Use, duplication, or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 ********************************************************* {COPYRIGHT-END} *** */
const _ = require('lodash');

module.exports.configure = config => {
	/* istanbul ignore else */
	if (config.has('env')) {
		const envVariables = config.get('env');
		_.toPairs(envVariables).forEach(([key, value]) => {
			process.env[key] = value;
		});
	}
};
