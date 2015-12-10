var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')

debug('PL sync loaded at ' + Date().toString())

var entu      = require('../helpers/entu')

FETCH_DELAY_MS = 1 * 60 * 1000

var state = 'idle'


cacheReloadSuggested = false
var plLanguages = ['est', 'eng']
var mapPL2Entu = {}
var syncWaterfall = []


syncWaterfall.push(function startSync(callback) {
    state = 'busy'
    callback()
})

// Fetch from PL
syncWaterfall.push(function fetchFromPL(callback) {
    // debug('Fetch from Piletilevi')
    var url = 'http://www.piletilevi.ee/api/action/filter/?types=category,show,concert,venue&export=venue&order=date,desc&filter=venueId/245;concertActive&limit=10000&start=0&language='
    var PLData = {}
    async.each(plLanguages, function(plLanguage, callback) {
        request({
            url: url + plLanguage,
            json: true,
            timeout: 10 * 1000
        }, function (error, response, body) {
            if (error) {
                debug('PL responded with ', error)
                callback(error)
            } else if (response.statusCode !== 200) {
                debug('Response status for language ' + plLanguage + ': ' + response.statusCode)
                callback('PL responded with ' + response.statusCode)
            } else {
                op.set(PLData, plLanguage, body.responseData)
                callback()
            }
        })
    }, function(err) {
        if (err) { return callback(err) }
        // debug('Fetched from Piletilevi')
        callback(null, PLData)
    })
})



// Parse PL data
syncWaterfall.push(function parsePLData(PLData, callback) {
    // debug('Parse Piletilevi data')
    var PLCategories = {}
    var PLShows = {}
    var PLConcerts = {}
    async.each(plLanguages, function(plLanguage, callback) {
        // debug(JSON.stringify(PLData[plLanguage], null, 4))
        async.forEachOf(PLData[plLanguage], function(plItems, plDefinition, callback) {
            if(!Array.isArray(plItems)) { return callback() }
            // debug(JSON.stringify([plLanguage, plDefinition, plItems], null, 4))
            async.each(plItems, function(item, callback) {
                switch (plDefinition) {
                    case 'category':
                        // debug('Parse Piletilevi ' + plDefinition)
                        op.set(PLCategories, [item.id, 'id'], item.id)
                        op.set(PLCategories, [item.id, 'parent'], item.parentCategoryId)
                        op.set(PLCategories, [item.id, 'title', plLanguage], item.title)
                        break
                    case 'concert':
                        // debug('Parse Piletilevi ' + plDefinition)
                        op.set(PLConcerts, [item.id, 'id'],             parseInt(item.id, 10))
                        op.set(PLConcerts, [item.id, 'showId'],         parseInt(item.showId, 10))
                        op.set(PLConcerts, [item.id, 'startTimestamp'], parseInt(item.startTime.stamp, 10))
                        op.set(PLConcerts, [item.id, 'endTimestamp'],   parseInt(item.endTime.stamp, 10))
                        op.set(PLConcerts, [item.id, 'salesTimestamp'], parseInt(item.salesTime.stamp, 10))
                        op.set(PLConcerts, [item.id, 'salesStatus'],    item.salesStatus)
                        op.set(PLConcerts, [item.id, 'minPrice'],       item.minPrice)
                        op.set(PLConcerts, [item.id, 'maxPrice'],       item.maxPrice)
                        break
                    case 'show':
                        // debug('Parse Piletilevi ' + plDefinition)
                        var descriptionLanguages = item.descriptionLanguages.split(',')
                        var translatedLang = false
                        for (i in descriptionLanguages) {
                            if (descriptionLanguages[i] === plLanguage) {
                                translatedLang = true
                                break
                            }
                        }
                        op.set(PLShows, [item.id, 'id'], item.id)
                        op.set(PLShows, [item.id, 'category'], item.categories)
                        op.set(PLShows, [item.id, 'descriptionLanguages'], item.descriptionLanguages)
                        op.set(PLShows, [item.id, 'originalImageUrl'], item.originalImageUrl)
                        op.set(PLShows, [item.id, 'shortImageUrl'], item.shortImageUrl)
                        if (translatedLang) {
                            op.set(PLShows, [item.id, 'title', plLanguage], item.title)
                            op.set(PLShows, [item.id, 'description', plLanguage], item.description)
                            op.set(PLShows, [item.id, 'purchaseDescription', plLanguage], item.purchaseDescription)
                        }
                        break
                    default:
                        // debug('Ignore Piletilevi ' + plDefinition)
                        // break
                }
                callback()
            }, function(err) {
                if (err) { return callback(err) }
                callback()
            })
        }, function(err) {
            if (err) { return callback(err) }
            callback()
        })
    }, function(err) {
        if (err) { return callback(err) }
        // debug('Each succeeded for parse PL data')
        callback(null, { 'category': PLCategories, 'concert': PLConcerts, 'show': PLShows })
    })
})

var mapPlDefinitions = {
    'category': {eId: 1976, eDefinition: 'category'},
    'concert': {eId: 597, eDefinition: 'event'},
    'show': {eId: 1935, eDefinition: 'performance'}
}

function createNewEntity(plDefinition, plItem, callback) {
    debug('Creating new ' + op.get(mapPlDefinitions, [plDefinition, 'eDefinition']), plItem)
    callback(null, 'dummyEid')
}
function syncWithEntu(plDefinition, plItem, eId, callback) {
    // debug('Matching: ', eId, plItem)

    entu.get_entity(eId, null, null, function entuCB(err, opEntity) {
        if (err) { return callback(err) }

        var eItem = opEntity.get()
        if (op.get(mapPlDefinitions, [plDefinition, 'eDefinition']) !== eItem.definition) {
            return callback('PL definition ' + plDefinition + ' do not match Entu definition ' + eItem.definition)
        }

        // debug('Matching ', 'E' + eItem.id + ' ?= PL' + plItem.id)
        var propertiesToUpdate = {'eId': eItem.id, 'definition': eItem.definition}

        function removeIfMultiProperty(eItem, propertyName) {
            var propertyArray = op.get(eItem, ['properties', propertyName])
            if (Array.isArray(propertyArray)) {
                async.eachSeries(propertyArray, function iterator(property, callback) {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'id'], property.id)
                    callback()
                })
            }
        }
        function compareDates(eItem, propertyName, tsPL) {
            // debug('compare ' + propertyName + ' pl:', tsPL, 'E:', eItem)
            removeIfMultiProperty(eItem, propertyName)
            tsPL = parseInt(tsPL, 10) * 1000
            var propertyEid = op.get(eItem, ['properties', propertyName, 'id'])
            var dateStringEntu = op.get(eItem, ['properties', propertyName, 'value'], false)
            var tsE = 0
            if (dateStringEntu) {
                tsE = (new Date(dateStringEntu + ' GMT+0000')).getTime()
            }
            if (tsE !== tsPL) {
                debug('E' + eItem.id + ' ?= PL' + plItem.id, new Date(tsE) + '!==' + new Date(tsPL))
                op.set(propertiesToUpdate, ['properties', propertyName, 'id'], propertyEid)
                if (tsPL === 0) {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'value'], '')
                } else {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'value'], (new Date(tsPL).toJSON().replace('T', ' ').slice(0,19)))
                }
            } else {
                // debug('E' + eItem.id + ' ?= PL' + plItem.id, new Date(tsE) + '===' + new Date(tsPL))
            }
        }
        function compare(eItem, propertyName, strPL) {
            removeIfMultiProperty(eItem, propertyName)
            var propertyEid = op.get(eItem, ['properties', propertyName, 'id'], false)
            var strEntu = op.get(eItem, ['properties', propertyName, 'value'], '')
            // debug(eItem.id, strEntu + '?==' + strPL)
            if (strEntu !== strPL) {
                if (propertyEid !== false) {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'id'], propertyEid)
                }
                op.set(propertiesToUpdate, ['properties', propertyName, 'value'], strPL)
            }
        }

        if (eItem.definition === 'category') {
            compare(      eItem, 'et-name', op.get(plItem, ['title', 'est'],    '') )
            compare(      eItem, 'en-name', op.get(plItem, ['title', 'eng'],    '') )
        } else if (eItem.definition === 'event') { // PL 'concert'
            compareDates( eItem, 'start-time',   op.get(plItem, ['startTimestamp'],   0) )
            compareDates( eItem, 'end-time',     op.get(plItem, ['endTimestamp'],     0) )
            compareDates( eItem, 'sales-time',   op.get(plItem, ['salesTimestamp'],   0) )
            compare(      eItem, 'sales-status', op.get(plItem, ['salesStatus'],     '') )
            compare(      eItem, 'min-price',    op.get(plItem, ['minPrice'],        '') )
            compare(      eItem, 'max-price',    op.get(plItem, ['maxPrice'],        '') )
        } else if (eItem.definition === 'performance') { // PL 'show'
            compare     ( eItem, 'photo-url',    op.get(plItem, ['originalImageUrl'], 0) )
            compare     ( eItem, 'thumb-url',    op.get(plItem, ['shortImageUrl'], 0) )
        }

        if (op.get(propertiesToUpdate, ['properties'], false) === false) {
            // debug('== +++ === Good enough match for ' + eItem.definition, 'E' + eItem.id + ' ?= PL' + plItem.id)
            callback(null)
        } else {
            cacheReloadSuggested = true
            debug('| Needs syncing', 'E' + eItem.id + ' ?= PL' + plItem.id, op.get(propertiesToUpdate, ['properties']))
            async.forEachOfSeries(op.get(propertiesToUpdate, ['properties']), function (newValue, propertyName, callback) {
                var params = {
                    entity_id: eItem.id,
                    entity_definition: eItem.definition,
                    dataproperty: propertyName,
                    property_id: newValue.id,
                    new_value: newValue.value
                }
                debug('|__ Needs syncing', 'E' + eItem.id + ' ?= PL' + plItem.id, params)
                entu.edit(params, callback)
            }, function (err) {
                if (err) return callback(err)
                callback()
            })
        }
    })
}

syncWaterfall.push(function compareToEntu(PLData, callback) {
    // debug('compareToEntu', PLData, mapPL2Entu)
    async.forEachOfSeries(mapPlDefinitions, function(eDefinition, plDefinition, callback) {
        async.forEachOfSeries(PLData[plDefinition], function(val, key, callback) {
            // debug('Compare: ', eDefinition.eDefinition, plDefinition, key)
            if (op.get(mapPL2Entu, key, false) === false) {
                createNewEntity(plDefinition, val, function(err, newEid) {
                    if (err) { return callback(err) }
                    debug('Success. id:' + newEid)
                    op.set(mapPL2Entu, key, newEid)
                    callback()
                })
            } else {
                syncWithEntu(plDefinition, val, op.get(mapPL2Entu, key), function(err) {
                    if (err) { return callback(err) }
                    callback()
                })
            }
        }, function(err) {
            if (err) { return callback(err) }
            callback()
        })
    }, function(err) {
        if (err) { return callback(err) }
        // debug('syncWithEntu finished')
        callback()
    })
})


// Final cleanup
syncWaterfall.push(function cleanup(callback) {
    // debug('Routine finished OK')
    callback()
})


function routine(CacheReloadCB) {
    debug('PL sync routine started at ' + Date().toString())
    function restartInFive() {
        // setTimeout(function(){debug('4')}, 1*1000)
        // setTimeout(function(){debug('3')}, 2*1000)
        // setTimeout(function(){debug('2')}, 3*1000)
        // setTimeout(function(){debug('1')}, 4*1000)
        // debug('Restarting routine in 5')
        setTimeout(function() {
            routine(CacheReloadCB)
        }, 5*1000)
    }
    async.waterfall(syncWaterfall, function routineFinally(err) {
        state = 'sleeping'
        if (err === 'Missing local cache') {
            debug('No cache. Restarting routine in ' + FETCH_DELAY_MS/1000 + ' sec.')
            setTimeout(function() {
                restartInFive()
            }, FETCH_DELAY_MS - 5*1000)
            return
        }
        if (err) {
            debug('Routine stumbled. Restart in 25', err)
            setTimeout(function() {
                restartInFive()
            }, 20*1000)
            return
        }
        if (cacheReloadSuggested) {
            cacheReloadSuggested = false
            CacheReloadCB(null, 'Got updates from PL')
        }
        debug('Restarting routine in ' + FETCH_DELAY_MS/1000 + ' sec.')
        setTimeout(function() {
            restartInFive()
        }, FETCH_DELAY_MS - 5*1000)
    })
}

function preloadIdMapping(callback) {
    debug('PL sync preloader started at ' + Date().toString())
    async.forEachOfSeries(mapPlDefinitions, function iterator(eValue, plDefinition, callback) {
        entu.get_childs(eValue.eId, eValue.eDefinition, null, null, function(err, opEntities) {
            if (err) { return callback(err) }
            async.each(opEntities, function(opEntity, callback) {
                if (opEntity.get(['properties', 'pl-id', 'value'], false) !== false) {
                    op.set(mapPL2Entu, String(opEntity.get(['properties', 'pl-id', 'value'])), String(opEntity.get(['id'])))
                }
                callback()
            }, function(err) {
                if (err) { return callback(err) }
                callback()
            })
        })
    }, function finalCB(err) {
        if (err) { return callback(err) }
        // debug('Existing entities mapped to PL id\'s')
        callback()
    })
}

function startRoutine(CacheReloadCB) {
    async.series([
        function preloader(callback) {
            preloadIdMapping(callback)
        },
        function runRoutine(callback) {
            routine(CacheReloadCB)
            callback()
        }
    ], function(err) {
        if (err) { return CacheReloadCB(err) }
        // debug('PL sync routine started.')
    })
}
module.exports.routine = startRoutine
module.exports.state = state
