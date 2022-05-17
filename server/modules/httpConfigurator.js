const http = require('http');
const logger = require('./loggingConfigurator').getLogger('app');

const onError = error => {
	if (error.syscall !== 'listen') {
		throw error;
	}
	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES': {
			logger.error('Address requires elevated privileges');
			process.exit(1);
			break;
		}
		case 'EADDRINUSE': {
			logger.error('Address is already in use');
			process.exit(1);
			break;
		}
		default: {
			throw error;
		}
	}
};

/* istanbul ignore next */
/* eslint-disable no-console */
const onListening = server => {
	return () => {
		const address = server.address();
		const bind = typeof address === 'string' ? `pipe ${address}` : `${address.address}:${address.port}`;
		logger.info(`Listening on ${bind}`);
	};
};

module.exports.configure = (app, config) => {
	const server = http.createServer(app);
	server.listen(config.get('http.port'), '0.0.0.0');
	server.on('error', onError);
	server.on('listening', onListening(server));
	return server;
};
