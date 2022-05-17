/* eslint-disable no-underscore-dangle */
const _ = require('lodash');

const getRequestIP = req => req.headers['x-forwarded-for'] || req.connection.remoteAddress;

const getTookTime = (req, res) =>
	_.isNil(req._startAt) || _.isNil(res._startAt)
		? ''
		: (res._startAt[0] - req._startAt[0]) * 1e3 + (res._startAt[1] - req._startAt[1]) * 1e-6;

const getResponseStatusCode = res => (_.isNil(res.statusCode) ? -1 : _.toNumber(res.statusCode));

const getResponseContentLength = res => (_.isNil(res._contentLength) ? -1 : _.toNumber(res._contentLength));

const getRequestUrl = req => {
	const reqUrl = req.originalUrl || req.url;
	return _.isNil(reqUrl) ? '' : reqUrl;
};

const getRequestMethod = req => (_.isNil(req.method) || _.isEmpty(req.method) ? '' : req.method);

const getRequestUserAgent = req => {
	return _.get(req, 'headers.user-agent', '');
};

const getRequestId = req => _.get(req, 'uuidv4', '');

const getAdopterId = req => _.get(req, 'params.appid', '');

const getRequestOrigin = req => _.get(req, 'headers.origin', '');

const getRequestReferrer = req => _.get(req, 'headers.refferer', '');

module.exports = {
	getTookTime,
	getResponseStatusCode,
	getResponseContentLength,
	getRequestIP,
	getRequestUrl,
	getRequestMethod,
	getRequestUserAgent,
	getRequestId,
	getRequestOrigin,
	getRequestReferrer,
	getAdopterId
};
