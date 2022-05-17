const app = require('express')();
// const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');
const helmet = require('helmet');
const noCache = require('nocache');
const cors = require('cors');
const queryType = require('query-types');
const routes = require('./routes/index');
const { getMorganLogger, getLogger } = require('./loggingConfigurator');

const logger = getLogger('app');

/**
 * @param {String} url the request url
 * @param {Array} excludedUrlPatterns array of strings patters
 */
const isUrlExcluded = (url, excludedUrlPatterns) =>
	url &&
	excludedUrlPatterns &&
	excludedUrlPatterns.filter(e => e).some(excludedPattern => url.includes(excludedPattern));

const generateUUID = excludedUrlPatterns => (req, res, next) => {
	if (isUrlExcluded(req.url, excludedUrlPatterns)) {
		next();
	} else {
		req.uuidv4 = uuidv4();
		res.uuidv4 = req.uuidv4;
		next();
	}
};

const generateResponseUuidHeader = excludedUrlPatterns => (req, res, next) => {
	if (isUrlExcluded(req.url, excludedUrlPatterns)) {
		next();
	} else {
		res.header('X-Search-Response-Id', res.uuidv4);
		next();
	}
};

/** handle that checks that each request has expected authorization header, must be before other middlewares */
/* eslint-disable-next-line no-unused-vars */
const getAuthorizationHeaderHandler = allAuthorizationHeaders => {
	const configuredHeaders =
		allAuthorizationHeaders && allAuthorizationHeaders.length > 0
			? allAuthorizationHeaders.split(',').map(str => {
					return str.trim();
			  })
			: [];
	return (req, res, next) => {
		if (configuredHeaders.length > 0) {
			const currentRequestAuthorizationHeader = req.get('authorization');
			if (!currentRequestAuthorizationHeader || configuredHeaders.indexOf(currentRequestAuthorizationHeader) === -1) {
				logger.debug(
					'Request forbidden, 403, authorization header missing or value not matching. ',
					currentRequestAuthorizationHeader
				);
				res.sendStatus(403);
			} else {
				next();
			}
		} else {
			next();
		}
	};
};

const getMonitoringHandler = (path, responseCode) => {
	return (req, res, next) => {
		if (req.originalUrl === path) {
			res.sendStatus(responseCode);
		} else {
			next();
		}
	};
};

/* eslint-disable-next-line no-unused-vars */
const ipcInfoCookieParser = (req, res, next) => {
	/* istanbul ignore else */
	if (req.cookies && req.cookies.ipcInfo) {
		logger.debug('Got ipcInfo cookie: ', req.cookies.ipcInfo);
		const ipcCookie = req.cookies.ipcInfo;
		// the content of the cookie

		const re = /([lc]c)=([a-zA-Z]{2})/gi;
		// regex that will match cc or lc

		let match;

		// following loop will add matches of the above to the ipcInfo object
		/* eslint-disable-next-line no-cond-assign */
		while ((match = re.exec(ipcCookie)) !== null) {
			req.ipcInfo = req.ipcInfo || {}; // sets new ipcInfo object in req if not set yet
			req.ipcInfo[match[1].toLowerCase()] = match[2].toLowerCase();
		}
	} else {
		logger.debug('No cookies or no ipcInfo cookie');
	}
	next();
};

module.exports.configure = config => {
	const expressConfig = config.get('express');

	// req / res ID
	app.use(generateUUID(expressConfig.uuidExcludeUrlPatterns));

	// morgan logging middleware
	app.use(getMorganLogger());

	// APP HEADER SECURITY
	app.use(
		helmet({
			frameguard: { action: 'deny' }, // to prevent clickjacking
			xssFilter: true, // adds some small XSS protections
			noSniff: true // to keep clients from sniffing the MIME type
		})
	);

	app.use(noCache());

	// handler for monitoring, added first to allow response without authorization header
	app.use(getMonitoringHandler(expressConfig.status.path, expressConfig.status.responseCode));

	// NOTE: DISABLED AUTHORIZATION HEADER
	// app.use(getAuthorizationHeaderHandler(config.get('express.requiredAuthorizationHeader')));

	// disabling etag as we have nocache
	app.disable('etag');

	/* HANDLE CORS */
	const corsOptions = {
		origin: '*',
		optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
		methods: ['GET', 'POST', 'OPTIONS'],
		allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Cache-Control']
	};
	app.use(cors(corsOptions));

	// generate X-Response-Id
	app.use(generateResponseUuidHeader(expressConfig.uuidExcludeUrlPatterns));

	app.use(bodyParser.json());
	app.use(
		bodyParser.urlencoded({
			extended: false
		})
	);

	app.use(queryType.middleware());
	// app.use(cookieParser());
	// app.use(ipcInfoCookieParser);

	// configure the routes
	routes.configure(app, config);
	return app;
};
