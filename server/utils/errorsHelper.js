const _ = require('lodash');
const stringSimilarity = require('string-similarity');

/**
 * Process raw errors, adds engine name/alias calculated from err.url (which we stored after fetches to engines),
 * removes url after
 * @param {*} rawDataArray
 * @param {*} componentsConfig
 * @returns data array with post-processed errors
 */
const processErrors = (rawDataArray, componentsConfig) =>
	_.map(rawDataArray, response => {
		if (_.has(response, 'error')) {
			const { upstreamServices } = componentsConfig;
			let engineConfig = _.find(upstreamServices, service => _.includes(response.error.url, service.url));
			if (_.isNil(engineConfig)) {
				const matches = stringSimilarity.findBestMatch(
					response.error.url,
					_.map(upstreamServices, service => service.url)
				);
				engineConfig = _.find(upstreamServices, service => _.includes(matches.bestMatch.target, service.url));
			}
			const { engineAlias } = engineConfig;
			_.set(response, 'error.service', engineAlias);
			_.unset(response, 'error.url');
			return response;
		}
		return response;
	});

/**
 * Orders how Error response object will look like in json
 * @param {*} error original error
 * @returns sorted error in specific order of keys
 */
const sortError = error => ({
	service: error.service,
	status: error.status,
	...(!_.isNil(error.message) && { message: error.message })
});

/**
 * This FN is used on triaging errors for generation of normal response - when some engine failed.
 * @param {} errors errors from triaged data
 * @returns sorted errors according to sortError FN schema
 */
const sortErrors = errors => _.map(errors, e => sortError(e));

/**
 * Generation of error response on debug/explain when all engines failed
 * @param {*} req expres req
 * @param {*} dataArray response data array containing only errors
 * @returns Falcon/ESQS like response object
 */
const generateDebugErrorResponse = (req, dataArray) => ({
	resultset: {
		searchquery: {
			...(_.has(req, 'params.appid') && { appid: req.params.appid }),
			...(_.has(req, 'query.query') && { userquery: req.query.query }),
			upstreamServices: _.map(dataArray, e => sortError(e.error))
		}
	}
});

/**
 * This FN is used after triageResults FN in generation of response, it cuts out errors from triaged results,
 * and returns only errors. These errors array is used in building API response object then.
 * @param {*} triagedResults triaged data
 * @returns array of errors
 */
const triageErrors = triagedResults => {
	let result = [];
	const errors = _.get(triagedResults, 'errors', []);
	if (!_.isEmpty(errors)) {
		result = sortErrors(errors);
	}
	_.unset(triagedResults, 'errors');
	return result;
};

const isRawDataErrorsOnly = rawDataArray => _.every(rawDataArray, e => _.has(e, 'error'));

module.exports = {
	processErrors,
	generateDebugErrorResponse,
	isRawDataErrorsOnly,
	triageErrors
};
