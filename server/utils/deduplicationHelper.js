const columnify = require('columnify');
const _ = require('lodash');
const { ObjectUtils, isString } = require('./typesHelper');
const ConfigHelper = require('./configHelper');
const logger = require('../loggingConfigurator').getLogger('app');
const { getDefaultCountsOfServices } = require('../routes/bookmarkHelper');

let requestedRemoveCount = 0;
/**
 * Helper which marks result as: isDuplicate=true
 * @param {Array} results of objects
 */
const markDuplicates = (results = []) => {
	const resultsMarked = [];
	let duplicates = 0;
	results.reduce((uniqueStack, result) => {
		const { title, description } = result;
		if (ObjectUtils.hasProperty(uniqueStack, title) && uniqueStack[title] === description) {
			duplicates += 1;
			result = { ...result, isDuplicate: true }; // eslint-disable-line no-param-reassign
		} else {
			uniqueStack[title] = description; // eslint-disable-line no-param-reassign
		}
		resultsMarked.push(result);
		return uniqueStack;
	}, {});
	logger.warn(`Duplicates found in ESQS: ${duplicates}`);
	return resultsMarked;
};

/**
 * Helper which marks result as: isDuplicate=true for same array as remove dup elements
 * @param {Array} results of objects
 */
const markDuplicatesOnCount = (results = [], countToRemove = -1) => {
	const resultsMarked = [];
	let duplicates = 0;
	let removed = 0;
	results.reduce((uniqueStack, result) => {
		const { title, description } = result;
		if (_.has(uniqueStack, title) && uniqueStack[title] === description) {
			duplicates += 1;
			if (countToRemove === -1 || removed < countToRemove) {
				removed += 1;
				result = { ...result, isDuplicate: true }; // eslint-disable-line no-param-reassign
			}
		} else {
			uniqueStack[title] = description; // eslint-disable-line no-param-reassign
		}
		resultsMarked.push(result);
		return uniqueStack;
	}, {});
	logger.warn(`Duplicates found in ESQS: ${duplicates}`);
	return resultsMarked;
};

/**
 * Removes already marked duplicated from array of results, if count specified -
 * removes specific number of duplicates, if not specified removes all
 * @param {Array} resultsMarkedDuplicates array of marked duplicates
 * @param {*} countToRemove number of duplicates to be removed, by default removes all
 */
const removeMarkedDuplicates = (resultsMarkedDuplicates = [], countToRemove = -1) => {
	let removed = 0;
	const dedups = resultsMarkedDuplicates.reduce((deduplicated, currResult) => {
		if (currResult.isDuplicate && (countToRemove === -1 || removed < countToRemove)) {
			removed += 1;
			logger.debug(`Duplicate removed: ${currResult.title}`);
			return deduplicated;
		}
		deduplicated.push(currResult);
		return deduplicated;
	}, []);
	logger.debug(`Removed '${removed}' duplicated !`);
	return dedups;
};

const countDuplicates = (results = []) => {
	const uniqueStack = {};
	return results.reduce((duplicatesCount, result) => {
		const { title, description } = result;
		if (ObjectUtils.hasProperty(uniqueStack, title) && uniqueStack[title] === description) {
			return duplicatesCount + 1;
		}
		uniqueStack[title] = description;
		return duplicatesCount;
	}, 0);
};

/**
 * Removes duplicates from results. If count specified -
 * removes specific number of duplicates, if not specified removes all
 * @param {Array} results
 * @param {Number} countToRemove
 */
const removeDuplicates = (results = [], countToRemove = -1) => {
	if (countToRemove === 0) {
		return results;
	}
	let duplicates = 0;
	let removed = 0;
	const uniqueStack = {};
	const deduplicatedResults = results.filter(result => {
		const { title, description } = result;
		if (ObjectUtils.hasProperty(uniqueStack, title) && uniqueStack[title] === description) {
			duplicates += 1;
			if (countToRemove === -1 || removed < countToRemove) {
				removed += 1;
				return false;
			}
		}
		uniqueStack[title] = description;
		return true;
	});
	logger.debug(`Duplicates found in ESQS: ${duplicates}`);
	logger.debug(`Duplicates removed in ESQS: ${results.length - deduplicatedResults.length}`);
	return deduplicatedResults;
};

const getDuplicatesStats = (results = []) => {
	const stats1 = results.reduce((stack, result) => {
		const { title, description, url } = result;
		if (ObjectUtils.hasProperty(stack, title) && stack[title].description === description) {
			stack[title].count += 1; // eslint-disable-line no-param-reassign
			return stack;
		}
		stack[title] = { count: 0, description, url }; // eslint-disable-line no-param-reassign
		return stack;
	}, {});

	// remap to array of objects
	const stats2 = Object.entries(stats1).map(([key, value]) => ({
		title: key,
		description: value.description,
		url: value.url,
		duplicates: value.count
	}));

	return stats2;
};

const getDuplicatesStatsTable = (results = []) => {
	const stats = getDuplicatesStats(results);
	return results && results.length > 0
		? columnify(stats, {
				columns: Object.keys(stats[0]),
				columnSplitter: ' | ',
				maxWidth: 50,
				truncate: true
		  })
		: '';
};

/**
 * Checks if deduplication is enabled, and also checks if req.query contains disableGrouping=title_snippet
 * @param {Object} deduplicationConfig
 * @param {Object} reqQueryParams
 */
const isDeduplicationEnabled = (deduplicationConfig, reqQueryParams) => {
	const { disableGrouping = '' } = reqQueryParams;
	const isDisabledGroupingTitleSnippet =
		isString(disableGrouping) && disableGrouping.length > 0 && disableGrouping === 'title_snippet';
	return ConfigHelper.isEnabledInConfig(deduplicationConfig, 'esqs', 'enabled') && !isDisabledGroupingTitleSnippet;
};

const markDuplicateUrl = esqsResults => {
	const duplicateUrlRes = [];
	_.each(esqsResults, (esqsRes, index) => {
		if (!_.includes(duplicateUrlRes, esqsRes.url)) {
			duplicateUrlRes.push(esqsRes.url);
		} else {
			esqsResults[index] = { ...esqsRes, isDuplicateUrl: true };
		}
	});
};

const removeUrlDuplicates = (esqsRes, esqsSplitConfigLength, duplUrl0toSplit, countToRemove) => {
	let deduplicatedResults = [];

	if (duplUrl0toSplit > countToRemove) {
		duplUrl0toSplit = countToRemove;
	}
	const startToSplit = esqsRes.slice(0, esqsSplitConfigLength);
	const splitToEnd = esqsRes.slice(esqsSplitConfigLength);
	let removedDuplicatesCounter = 0;
	_.each(startToSplit, res => {
		if (
			!_.isNil(res.isDuplicateUrl) &&
			_.isEqual(res.isDuplicateUrl.toString(), 'true') &&
			removedDuplicatesCounter <= duplUrl0toSplit
		) {
			removedDuplicatesCounter += 1;
		} else {
			deduplicatedResults.push(res);
		}
	});
	deduplicatedResults = [...deduplicatedResults, ...splitToEnd];
	requestedRemoveCount -= duplUrl0toSplit;
	return deduplicatedResults;
};
/**
 * Main method used for deduplication in aggr app code
 * @param {*} triagedData
 * @param {*} deduplicationConfig
 * @param {*} req
 */
const deduplicate = (triagedData, componentsConfig, req) => {
	const { defaultCountEsqs, defaultCountKC } = getDefaultCountsOfServices(componentsConfig, req);
	const deduplicationConfig = componentsConfig.deduplication;
	const deduplicatedTriagedData = JSON.parse(JSON.stringify(triagedData));

	Object.keys(triagedData).forEach(serviceName => {
		switch (serviceName) {
			case 'knowledgeCenter': {
				/* istanbul ignore else */
				if (!(!_.isNil(req.query.sm) && req.query.sm === 'false')) {
					/* istanbul ignore else */
					if (!_.isNil(deduplicatedTriagedData.esqs) && !_.isNil(deduplicatedTriagedData.knowledgeCenter)) {
						/* istanbul ignore else */
						if (deduplicatedTriagedData.esqs.smCount > 0) {
							let smResults = [];
							smResults = deduplicatedTriagedData.esqs.results.slice(0, deduplicatedTriagedData.esqs.smCount);
							const kcDpuArr = [];
							let dupCounter = 0;
							const {
								knowledgeCenter: { results = [] }
							} = triagedData;
							let kcResults = results;
							const kcMarkDupArr = results;

							// to remove the duplicated KC results from the SM results.
							_.forEach(smResults, smRes => {
								const kcArrLen = kcResults.length;
								_.forEach(kcResults, (kcRes, j) => {
									if (kcRes && smRes.title === kcRes.title && smRes.description === kcRes.description) {
										kcDpuArr.push(j + dupCounter);
										kcMarkDupArr[j + dupCounter].isDuplicate = true;
										dupCounter += 1;
										kcResults = kcResults.slice(0, j).concat(kcResults.slice(j + 1, kcArrLen));
									}
								});
							});

							// to calculate number of kc results in the interweaved results.
							let deficientEsqsRes = 0;
							const esqsRes = deduplicatedTriagedData.esqs.results.length;
							let totalKcResConsumed = 0;
							if (esqsRes < defaultCountEsqs) {
								deficientEsqsRes = defaultCountEsqs - esqsRes;
								totalKcResConsumed = deficientEsqsRes + defaultCountKC;
							} else {
								totalKcResConsumed = defaultCountKC;
							}

							// to calculate the index of last kc result.
							let dedupKcCounter = 0;
							let kcArrRange = 0;
							_.forEach(kcMarkDupArr, (kcMarkDupArrValue, i) => {
								if (kcMarkDupArrValue.isDuplicate !== true) {
									dedupKcCounter += 1;
									if (dedupKcCounter === totalKcResConsumed) {
										kcArrRange = i;
										return false;
									}
								}
								return '';
							});

							// to calculate number of extra KC results consumed.
							let extraKCResConsumedCounter = 0;
							_.forEach(kcDpuArr, value => {
								/* istanbul ignore else */
								if (value < kcArrRange) {
									extraKCResConsumedCounter += 1;
								}
							});
							logger.warn(`Duplicates found in KC: ${results.length - kcResults.length}`);
							logger.warn(
								`(${req.params.appid}) Duplicates found in ${serviceName}: '${results.length -
									kcResults.length}', Removed: ${extraKCResConsumedCounter}, for Req(${req.uuidv4}) Url('${
									req.endpoints.knowledgeCenter
								}')`
							);

							deduplicatedTriagedData.knowledgeCenter.results = kcResults;
							deduplicatedTriagedData.knowledgeCenter.extraKCRes = extraKCResConsumedCounter;
						}
					}
				}
				break;
			}
			case 'esqs': {
				/* istanbul ignore else */
				if (isDeduplicationEnabled(deduplicationConfig, req.query)) {
					const { esqs } = triagedData;

					/* istanbul ignore else */
					if (esqs && Object.keys(esqs).length > 0) {
						const {
							esqs: { results = [] }
						} = triagedData;
						const esqsSplitConfigLength = getDefaultCountsOfServices(componentsConfig, req).defaultCountEsqs;
						const { knowledgeCenter: { count: kcAvailable = 0 } = {} } = triagedData;

						requestedRemoveCount = deduplicationConfig.esqs.count;
						let esqsResults = _.cloneDeep(results);
						markDuplicateUrl(esqsResults);
						const countDuplicatesUrl = esqsResults.filter(x => x.isDuplicateUrl).length;
						let duplUrl0toSplit = 0;
						let duplUrlSplitToEnd = 0;
						if (countDuplicatesUrl > 0) {
							duplUrl0toSplit = esqsResults.slice(0, esqsSplitConfigLength).filter(x => x.isDuplicateUrl).length;
							duplUrlSplitToEnd = esqsResults.slice(esqsSplitConfigLength).filter(x => x.isDuplicateUrl).length;
							logger.info(`0-${esqsSplitConfigLength} duplicates Urls: ${duplUrl0toSplit}`);
							logger.info(`${esqsSplitConfigLength}-${esqsResults.length} duplicates Urls: ${duplUrlSplitToEnd}`);

							if (!_.isEqual(_.parseInt(kcAvailable, 10), 0)) {
								esqsResults = removeUrlDuplicates(
									esqsResults,
									esqsSplitConfigLength,
									duplUrl0toSplit,
									requestedRemoveCount
								);
							}

							deduplicatedTriagedData.esqs.results = esqsResults;
							deduplicatedTriagedData.esqs.count = esqsResults.length;
							deduplicatedTriagedData.esqs.extraEsqsRes = duplUrl0toSplit;
						}

						const duplicatesCount = countDuplicates(esqsResults);

						/* istanbul ignore else */
						if (duplicatesCount > 0) {
							// if no KC only remove what we can
							if (kcAvailable === 0 && esqsResults.length > req.query.nr) {
								const possibleToRemove = esqsResults.length - req.query.nr;
								if (possibleToRemove <= requestedRemoveCount) {
									// remove only requested even possible more
									requestedRemoveCount = possibleToRemove;
								}
							} else if (requestedRemoveCount > kcAvailable) {
								requestedRemoveCount = kcAvailable;
							}

							// extra added for pagination logic
							const markDuplicatesOnCountArr = markDuplicatesOnCount(esqsResults, requestedRemoveCount);
							const dupl0toSplit = markDuplicatesOnCountArr.slice(0, esqsSplitConfigLength).filter(x => x.isDuplicate)
								.length;
							const duplSplitToEnd = markDuplicates(esqsResults)
								.slice(esqsSplitConfigLength)
								.filter(x => x.isDuplicate).length;
							logger.info(`0-${esqsSplitConfigLength} duplicates: ${dupl0toSplit}`);
							logger.info(`${esqsSplitConfigLength}-${esqsResults.length} duplicates: ${duplSplitToEnd}`);
							let counterAdded = 0 + duplUrl0toSplit;
							let found = 0;
							markDuplicatesOnCountArr.slice(17).forEach(e => {
								if (found !== dupl0toSplit) {
									if (!e.isDuplicate) {
										found += 1;
									}
									counterAdded += 1;
								}
							});
							logger.info(`Added: ${counterAdded}`);

							const deduplicatedResults = removeDuplicates(esqsResults, requestedRemoveCount);
							logger.warn(
								`(${
									req.params.appid
								}) Duplicates found in ${serviceName}: '${duplicatesCount}', Removed: ${esqsResults.length -
									deduplicatedResults.length}, for Req(${req.uuidv4}) Url('${req.endpoints.esqs}')`
							);
							deduplicatedTriagedData.esqs.results = deduplicatedResults;
							deduplicatedTriagedData.esqs.count = deduplicatedResults.length;
							deduplicatedTriagedData.esqs.extraEsqsRes = counterAdded;
						}
					}
				}
				break;
			}
			default: {
				break;
			}
		}
	});
	return deduplicatedTriagedData;
};

/**
 * Mutating REQ object: Increase number of results if deduplication enabled
 * @param {Object} req express request object
 * @param {Number} originalNrValue original NR value from req.query
 */
const increaseFetchResults = (componentsConfig = {}, reqQueryParams) => {
	const { nr = 0 } = reqQueryParams;
	const { deduplication = {} } = componentsConfig;
	// increase query NR if deduplication is enabled
	if (isDeduplicationEnabled(deduplication, reqQueryParams)) {
		const { esqs } = deduplication;
		const additionalFetchPercentage = ConfigHelper.getAsNumber(esqs, 'additionalFetchPercentage');
		if (additionalFetchPercentage > 0) {
			let increasedNr = Number.parseInt(nr, 10); // parse because query can be string!
			const additionalPercentage = Math.ceil(increasedNr * (additionalFetchPercentage / 100));
			increasedNr += additionalPercentage;
			return increasedNr;
		}
	}
	return nr;
};

module.exports = {
	markDuplicates,
	markDuplicatesOnCount,
	getDuplicatesStats,
	getDuplicatesStatsTable,
	removeMarkedDuplicates,
	removeDuplicates,
	countDuplicates,
	deduplicate,
	increaseFetchResults,
	isDeduplicationEnabled
};
