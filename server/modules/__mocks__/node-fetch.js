const config = require('config').get('test');
const logger = require('../loggingConfigurator').getLogger('test');

const mockData = {
	kc: {
		count: 20,
		next: 24,
		offset: 0,
		prev: -1,
		topics: [
			{
				date: 1427256000000,
				href: 'SSSR99/kc/watsoncurator.htm',
				label: 'IBM <b>Watson</b> Curator documentation',
				summary: 'IBM <b>Watson</b> Curator documentation Welcome to the IBM® <b>Watson</b>™'
			}
		],
		total: 500
	},
	esqs: {
		resultset: {
			link: 'https://www.ibm.com:443/search/esas/esqs/col/ibmcom',
			searchresults: {
				numresults: 20,
				searchresultlist: [
					{
						highlightedtext: {
							description: 'IBM <strong>Watson</strong> Analytics is no longer available for purchase.',
							summmary: ' IBM <strong>Watson</strong> Analytics Support Community Developer',
							title: 'IBM<strong>Watson</strong> Analytics',
							url: 'https://www.ibm.com/watson-analytics'
						}
					}
				],
				totalresults: 219302
			}
		}
	},
	catalog: {
		took: 13,
		timed_out: false,
		_shards: {
			total: 3,
			successful: 3,
			skipped: 0,
			failed: 0
		},
		hits: {
			total: 8,
			max_score: null,
			hits: [
				{
					_index: 'pitcher-global-1565031153543',
					_type: 'product',
					_id: '5b2bf8c32f881006717181c2',
					_score: 29.759567,
					_source: {
						doc: {
							kubernetes: [],
							'ideal-for-industry': ['Banking/Financial Services', 'Insurance', 'Telecommunications'],
							'product-key': 'IBM_PWB_301503611851',
							'doc-type': 'drupal',
							'offering-type': 'software',
							hasTrialAvailable: true,
							locale: {
								country: 'us',
								language: 'en',
								locale: 'en-us'
							},
							espots: {},
							url: 'https://www.ibm.com/cloud/db2-warehouse-on-cloud',
							primaryTaxonomyPictogramUrls: {
								gray: 'https://1.www.s81c.com/common/pictogram/product-category/analytics/gray--100.svg',
								white: 'https://1.www.s81c.com/common/pictogram/product-category/analytics/white--0.svg',
								blue: 'https://1.www.s81c.com/common/pictogram/product-category/analytics/blue--80.svg'
							},
							pictogram: '',
							'deployment-model': ['Cloud'],
							createdDate: 1486603722323,
							'meta-description':
								'IBM Db2 Warehouse on Cloud is a fully-managed, cloud data warehouse service powered by IBM BLU Acceleration and built for high-performance analytics and machine learning.',
							name: 'IBM Db2 Warehouse on Cloud',
							'call-to-action-primary': {
								label: 'Try on IBM Cloud',
								type: 'try-bluemix',
								url: 'https://console.bluemix.net/registration/?target=%2Fcatalog%2Fservices%2Fdb2-warehouse'
							},
							g2Crowd: {
								reviewCount: 36,
								rating: 8.1,
								g2CrowdProductUrl: 'https://www.g2crowd.com/products/ibm-db2-warehouse-on-cloud'
							},
							productType: 'product',
							'business-unit': 'Hybrid Cloud'
						},
						suggestedMatch: 'true'
					},
					sort: [1, 29.759567]
				}
			]
		},
		suggest: {
			keyword: [
				{
					text: 'db2',
					offset: 0,
					length: 3,
					options: []
				}
			]
		}
	}
};

const mockRetryError = {
	code: 'INFRA_EXCEPTION',
	hostName: 'esqs-mock-api',
	message: 'Query adapter connection timeout',
	additionalInformation: ''
};

const headers = new Map();
headers.set('content-type', 'application/json');

const fetch = url => {
	return new Promise((resolve, reject) => {
		let upstream;
		if (url.includes('esqs')) {
			upstream = 'esqs';
		} else if (url.includes('kc')) {
			upstream = 'kc';
		} else if (url.includes('catalog')) {
			upstream = 'catalog';
		} else if (url.includes('retry')) {
			upstream = 'retry';
		} else {
			upstream = 'bad';
		}

		// node-fetch docs says, for relative url they reject promise
		const isRelativeUrl = !(url.includes('http://') || url.includes('https://'));
		if (isRelativeUrl) {
			reject(new Error('Cannot use relative path as url'));
		}

		const mockResponse = {
			headers,
			json: () => {
				return mockResponse.returnObj;
			},
			addData: data => {
				mockResponse.returnObj = data;
			}
		};

		if (mockData[upstream]) {
			logger.debug('MOCK: Data resolved properly.');
			mockResponse.addData(mockData[upstream]);
			mockResponse.ok = true;
			mockResponse.status = 200;
			resolve(mockResponse);
		} else {
			mockResponse.ok = false;
			if (upstream === 'retry') {
				// simulate delay
				logger.debug(`MOCK: Simulating retry for: ${config.retryTimeout} ms`);
				setTimeout(() => {
					mockResponse.addData(mockRetryError);
					mockResponse.status = 400;
					resolve(mockResponse);
				}, config.retryTimeout);
			} else {
				logger.debug('MOCK: Returning 400 error...');
				mockResponse.addData(undefined);
				mockResponse.status = 400;
				resolve(mockResponse);
			}
		}
	});
};

module.exports = fetch;
