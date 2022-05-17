const _ = require('lodash');
const { BooleanUtils } = require('./modules/utils/typesHelper');
const logger = require('./modules/loggingConfigurator').getLogger('app');

const isNrDistributedTracingEnabled = () => {
	if (_.isNil(process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED)) {
		return false;
	}
	if (!BooleanUtils.isBoolean(process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED)) {
		return false;
	}
	return BooleanUtils.getBoolean(process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED);
};

const getAppName = () => {
	let nrAppName = 'kraken-default';
	if (!_.isNil(process.env.NEW_RELIC_APP_NAME)) {
		nrAppName = _.toString(process.env.NEW_RELIC_APP_NAME);
	}
	logger.info(`[NEWRELIC] App name: ${nrAppName}`);
	return nrAppName;
};

const getLicenseKey = () => {
	let nrLicenseKey = '';
	if (!_.isNil(process.env.NEW_RELIC_LICENSE_KEY)) {
		nrLicenseKey = _.toString(process.env.NEW_RELIC_LICENSE_KEY);
	}
	logger.info(`[NEWRELIC] License key: ${nrLicenseKey}`);
	return nrLicenseKey;
};
/**
/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
	app_name: [getAppName()],
	/**
	 * Your New Relic license key.
	 */
	license_key: getLicenseKey(),
	logging: {
		/**
		 * Level at which to log. 'trace' is most useful to New Relic when diagnosing
		 * issues with the agent, 'info' and higher will impose the least overhead on
		 * production applications.
		 */
		level: 'info'
	},
	distributed_tracing: {
		enabled: isNrDistributedTracingEnabled()
	}
};
