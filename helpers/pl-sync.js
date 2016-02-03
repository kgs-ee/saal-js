var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')
var Promise   = require('promise')
var moment    = require('moment-timezone')

debug('PL sync loaded at ' + Date().toString())

var entu      = require('../helpers/entu')

FETCH_DELAY_MS = 5 * 60e3

var state = 'idle' // If initial state is anything but 'idle', sync should not launch.
// state = 'off'


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
    debug('Fetch from Piletilevi')
    var url = 'http://www.piletilevi.ee/api/action/filter/?types=category,show,concert,venue&export=venue&order=date,desc&filter=venueId/245;concertActive&limit=10000&start=0&shop_provider=kanutigs&language='
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
        debug('Fetched from Piletilevi')
        callback(null, PLData)
    })
})



// Parse PL data
syncWaterfall.push(function parsePLData(PLData, callback) {
    debug('Parse Piletilevi data')
    var PLCategories = {}
    var PLShows = {}
    var PLConcerts = {}
    async.each(plLanguages, function(plLanguage, callback) {
        // debug(JSON.stringify(PLData[plLanguage], null, 4))
        async.forEachOf(PLData[plLanguage], function(plItems, plDefinition, callback) {
            if (!Array.isArray(plItems)) { return callback() }
            // debug(JSON.stringify([plLanguage, plDefinition, plItems], null, 4))
            async.each(plItems, function(item, callback) {
                switch (plDefinition) {
                    case 'category':
                        op.set(PLCategories, [item.id, 'raw', plLanguage], item)
                        // debug('Parse Piletilevi ' + plDefinition)
                        op.set(PLCategories, [item.id, 'id'], item.id)
                        op.set(PLCategories, [item.id, 'parent'], item.parentCategoryId)
                        op.set(PLCategories, [item.id, 'title', plLanguage], item.title)
                        break
                    case 'show': // performance
                        op.set(PLShows, [item.id, 'raw', plLanguage], item)
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
                        op.set(PLShows, [item.id, 'mobileUrl'], item.mobileUrl)
                        // if (translatedLang) {
                            op.set(PLShows, [item.id, 'title', plLanguage], item.title)
                            op.set(PLShows, [item.id, 'description', plLanguage], item.description)
                            op.set(PLShows, [item.id, 'purchaseDescription', plLanguage], item.purchaseDescription)
                        // }
                        break
                    case 'concert': // event
                        op.set(PLConcerts, [item.id, 'raw', plLanguage], item)
                        // debug('Parse Piletilevi ' + plDefinition)
                        // if (translatedLang) {
                            op.set(PLConcerts, [item.id, 'title', plLanguage], item.title)
                            op.set(PLConcerts, [item.id, 'description', plLanguage], item.description)
                        // }
                        op.set(PLConcerts, [item.id, 'id'], parseInt(item.id, 10))
                        op.set(PLConcerts, [item.id, 'showId'], parseInt(item.showId, 10))
                        op.set(PLConcerts, [item.id, 'startTimestamp'], parseInt(item.startTime.stamp, 10))
                        op.set(PLConcerts, [item.id, 'endTimestamp'], parseInt(item.endTime.stamp, 10))
                        op.set(PLConcerts, [item.id, 'salesTimestamp'], parseInt(item.salesTime.stamp, 10))
                        op.set(PLConcerts, [item.id, 'salesStatus'], item.salesStatus)
                        op.set(PLConcerts, [item.id, 'shopUrl'], item.shopUrl)
                        op.set(PLConcerts, [item.id, 'minPrice'], item.minPrice)
                        op.set(PLConcerts, [item.id, 'maxPrice'], item.maxPrice)
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
        debug('Each succeeded for parse PL data')
        callback(null, [
            { plDefinition: 'category', eDefinition: 'category', plItems: PLCategories},
            { plDefinition: 'show', eDefinition: 'performance', plItems: PLShows },
            { plDefinition: 'concert', eDefinition: 'event', plItems: PLConcerts},
        ])
    })
})


var mapPlDefinitions = {
    'category': {parentEid: 1976, eDefinition: 'category'},
    'show': {parentEid: 1935, eDefinition: 'performance'},
    'concert': {parentEid: 597, eDefinition: 'event'},
}

function syncWithEntu(plDefinition, plItem, eID, doFullSync, syncWithEntuCB) {
    // debug('Matching with eID', eID, (doFullSync ? 'FULL' : 'PARTIAL'))

    entu.getEntity(eID, null, null)
    .catch(function(reason) { return syncWithEntuCB(reason) })
    .then(function(opEntity) {
        if (opEntity.get(['properties', 'nosync', 'value']) === 'True') {
            return syncWithEntuCB(null)
        }
        var eItem = opEntity.get()
        // debug( JSON.stringify(eItem, null, 4) )
        // process.exit(0)
        if (op.get(mapPlDefinitions, [plDefinition, 'eDefinition']) !== eItem.definition) {
            debug('PL definition ' + plDefinition + ' do not match Entu definition ' + eItem.definition)
            return syncWithEntuCB('PL definition ' + plDefinition + ' do not match Entu definition ' + eItem.definition)
        }

        // debug('Matching ', 'E' + eItem.id + ' ?= PL' + plItem.id)
        var propertiesToUpdate = {'eID': eItem.id, 'definition': eItem.definition}

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
            var momentStrPL = moment((parseInt(tsPL, 10)) * 1000).tz('Europe/Tallinn').format('YYYY-MM-DD HH:mm:ss')

            var propertyEid = op.get(eItem, ['properties', propertyName, 'id'])
            var dateStringEntu = op.get(eItem, ['properties', propertyName, 'value'], false)
            var momentStrEntu = ''
            if (dateStringEntu) { momentStrEntu = moment(dateStringEntu).format('YYYY-MM-DD HH:mm:ss') }
            if (dateStringEntu && op.get(eItem, ['properties', propertyName, 'created_by'], false) !== String(APP_ENTU_USER)) { return }
            // debug('Dates E' + eItem.id + ' ?= PL' + plItem.id, momentStrEntu + '   ?==   ' + momentStrPL, tsPL)
            if (momentStrEntu !== momentStrPL) {
                debug('Dates E' + eItem.id + ' ?= PL' + plItem.id, momentStrEntu + '   !==   ' + momentStrPL, tsPL)
                op.set(propertiesToUpdate, ['properties', propertyName, 'id'], propertyEid)
                if (tsPL === 0) {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'value'], '')
                } else {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'value'], momentStrPL)
                }
            } else {
                // debug('E' + eItem.id + ' ?= PL' + plItem.id, new Date(tsE) + '===' + new Date(tsPL))
            }
            // process.exit(0)
        }
        function compareReferences(eItem, propertyName, idPLs) {
            idPLs.forEach(function(idPL) { compareReference(eItem, propertyName, idPL) })
        }
        function compareReference(eItem, propertyName, idPL) {
            var propertyEid = op.get(eItem, ['properties', propertyName, 'id'], false)
            var idEntu = Number(op.get(eItem, ['properties', propertyName, 'reference'], 0))
            if (idEntu > 0 && op.get(eItem, ['properties', propertyName, 'created_by'], false) !== String(APP_ENTU_USER)) { return }
            // debug(eItem.id, 'References ' + idEntu + '   ?==   ' + Number(op.get(mapPL2Entu, idPL, 0)))
            if (idEntu !== Number(op.get(mapPL2Entu, idPL, 0))) {
                debug(eItem.id, 'References ' + idEntu + '   !==   ' + Number(op.get(mapPL2Entu, idPL, 0)))
                if (propertyEid !== false) {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'id'], propertyEid)
                }
                op.set(propertiesToUpdate, ['properties', propertyName, 'value'], op.get(mapPL2Entu, idPL, 0))
            }
        }
        function compare(eItem, propertyName, strPL) {
            if (!strPL) {return}
            strPL = String(strPL)
            removeIfMultiProperty(eItem, propertyName)
            var propertyEid = op.get(eItem, ['properties', propertyName, 'id'], false)
            var strEntu = String(op.get(eItem, ['properties', propertyName, 'value'], ''))

            if (strEntu !== '' && op.get(eItem, ['properties', propertyName, 'created_by'], false) !== String(APP_ENTU_USER)) { return }
            // debug(eItem.id, 'Strings ' + strEntu + '   ?==   ' + strPL)
            if (strEntu !== strPL && strPL !== '') {
                debug(eItem.id, 'Strings ' + strEntu + '   !==   ' + strPL)
                if (propertyEid !== false) {
                    op.set(propertiesToUpdate, ['properties', propertyName, 'id'], propertyEid)
                }
                op.set(propertiesToUpdate, ['properties', propertyName, 'value'], strPL)
            }
        }

        if (eItem.definition === 'category') {
            compare( eItem, 'et-name', op.get(plItem, ['title', 'est'], '') )
            compare( eItem, 'en-name', op.get(plItem, ['title', 'eng'], '') )
            compare( eItem, 'pl-id', op.get(plItem, ['id'], '') )
        } else if (eItem.definition === 'performance') { // PL 'show'
            // debug ('photo-url', op.get(plItem, ['originalImageUrl'], '') )
            compare( eItem, 'photo-url', op.get(plItem, ['originalImageUrl'], '') )
            compare( eItem, 'thumb-url', op.get(plItem, ['shortImageUrl'], '') )
            compare( eItem, 'pl-link', op.get(plItem, ['url'], '') )
            compare( eItem, 'pl-id', op.get(plItem, ['id'], '') )
            compare( eItem, 'et-name', op.get(plItem, ['title', 'est'], '') )
            compare( eItem, 'en-name', op.get(plItem, ['title', 'eng'], '') )
            compare( eItem, 'et-description', op.get(plItem, ['description', 'est'], '') )
            compare( eItem, 'en-description', op.get(plItem, ['description', 'eng'], '') )
            compareReferences( eItem, 'category', op.get(plItem, ['categories'], []) )
        } else if (eItem.definition === 'event') { // PL 'concert'
            compareDates( eItem, 'start-time', op.get(plItem, ['startTimestamp'], 0) )
            compareDates( eItem, 'end-time', op.get(plItem, ['endTimestamp'], 0) )
            compareDates( eItem, 'sales-time', op.get(plItem, ['salesTimestamp'], 0) )
            compare( eItem, 'sales-status', op.get(plItem, ['salesStatus'], '') )
            compare( eItem, 'min-price', op.get(plItem, ['minPrice'], '') )
            compare( eItem, 'max-price', op.get(plItem, ['maxPrice'], '') )
            // if (doFullSync) {
            //     debug ('doFullSync', JSON.stringify(eItem, null, 4), JSON.stringify(plItem, null, 4))
            // }
            compare( eItem, 'pl-id', op.get(plItem, ['id'], '') )
            compare( eItem, 'ticket-api', op.get(plItem, ['shopUrl'], '') )
            compare( eItem, 'pl-link', op.get(plItem, ['shopUrl'], '') )
            compare( eItem, 'et-name', op.get(plItem, ['title', 'est'], '') )
            compare( eItem, 'en-name', op.get(plItem, ['title', 'eng'], '') )
            compare( eItem, 'et-description', op.get(plItem, ['description', 'est'], '') )
            compare( eItem, 'en-description', op.get(plItem, ['description', 'eng'], '') )
            compare( eItem, 'et-technical-information', op.get(plItem, ['purchaseDescription', 'est'], '') )
            compare( eItem, 'en-technical-information', op.get(plItem, ['purchaseDescription', 'eng'], '') )
            compareReference( eItem, 'performance', op.get(plItem, ['showId'], '') )
        }

        if (op.get(propertiesToUpdate, ['properties'], false) === false) {
            // debug('== +++ === Good enough match for ' + eItem.definition, 'E' + eItem.id + ' ?= PL' + plItem.id)
            return syncWithEntuCB(null)
        } else {
            cacheReloadSuggested = true
            debug('| Needs syncing', 'E' + eItem.id + ' ?= PL' + plItem.id, op.get(propertiesToUpdate, ['properties']))
            async.forEachOfSeries(op.get(propertiesToUpdate, ['properties']), function (newValue, propertyName, callback) {
                var properties = {
                    entity_id: eItem.id,
                    entity_definition: eItem.definition,
                    dataproperty: propertyName,
                    property_id: newValue.id,
                    new_value: newValue.value
                }
                // debug('|__ Needs syncing', 'E' + eItem.id + ' ?= PL' + plItem.id, properties)
                entu.edit(properties)
                .then(function() { callback() })
                .catch(function(reason) {
                    callback(reason)
                })
            }, function (err) {
                if (err) return syncWithEntuCB(err)
                return syncWithEntuCB(null)
            })
        }
    })
}

syncWaterfall.push(function compareToEntu(PLData, compareToEntuCB) {
    debug('compareToEntu started at ' + Date().toString())
    var entitiesToCreate = { category: [], show: [], concert: [] }

    async.eachSeries(PLData, function iterator(byDefinition, iteratorCB) {
        var plDefinition = byDefinition.plDefinition
        var eDefinition = byDefinition.eDefinition
        async.forEachOfSeries(byDefinition.plItems, function(plItem, plId, callback) {
            // debug('Compare: ', eDefinition, plDefinition, plId)
            var eID = op.get(mapPL2Entu, plId, false)
            if (eID === false) {
                op.push(entitiesToCreate, [plDefinition], plItem)
                callback()
            } else {
                syncWithEntu(plDefinition, plItem, eID, false, function(err) {
                    if (err) {
                        if (err.status === 404 && err.eID === eID) {
                            debug('Unmapping missing entity:', err.eID)
                            op.del(mapPL2Entu, plId)
                            op.push(entitiesToCreate, [plDefinition], plItem)
                            return callback()
                        }
                        debug('syncWithEntu errored:', err)
                        return callback(err)
                    }
                    callback()
                })
            }
        }, function(err) {
            if (err) {
                debug('Compare errored: ', eDefinition, plDefinition)
                return iteratorCB(err)
            }
            // debug('Compare succeeded: ', eDefinition, plDefinition)
            iteratorCB()
        })
    }, function(err) {
        if (err) {
            debug('compareToEntu failed.')
            return compareToEntuCB(err)
        }
        // debug('compareToEntu succeeded.')
        compareToEntuCB(null, entitiesToCreate)
    })
})

syncWaterfall.push(function createInEntu(PLData, createInEntuCB) {
    debug('createInEntu', JSON.stringify(PLData, null, 4))
    function createNewEntity(plDefinition) {
        // var parentEid = false
        var parentEid = op.get(mapPlDefinitions, [plDefinition, 'parentEid'], false)
        var eDefinition = op.get(mapPlDefinitions, [plDefinition, 'eDefinition'], false)
        return new Promise(function (fulfill, reject) {
            if (!parentEid) { return reject( eDefinition + ' not mapped.') }
            debug('Creating new ' + eDefinition)

            entu.add(parentEid, eDefinition, null, null, null)
            .then(function (newEid) {
                debug('Created new ' + eDefinition, newEid)
                return fulfill(newEid)
            })
            .catch(function(reason) {
                debug('createNewEntity failed with reason:', reason)
                return reject(reason)
            })
        })
    }

    async.forEachOfSeries(PLData, function iterator(byDefinition, plDefinition, iteratorCB) {
        debug('create', plDefinition)
        async.eachSeries(byDefinition, function(plItem, callback) {
            createNewEntity(plDefinition)
            .then(function(newEid) {
                debug('Success. id:' + newEid)
                op.set(mapPL2Entu, plItem.id, newEid)
                syncWithEntu(plDefinition, plItem, newEid, true, callback)
            })
            .catch(function(reason) {
                debug('createNewEntity failed with reason:', reason)
                // return callback(reason)
            })
        }, function(err) {
            if (err) { return iteratorCB(err) }
            iteratorCB()
        })
    }, function(err) {
        if (err) { return createInEntuCB(err) }
        createInEntuCB()
    })
})


// Final cleanup
syncWaterfall.push(function cleanup(callback) {
    debug('Final cleanup. Routine finished OK')
    callback()
})


function routine(routineCB) {
    debug('PL sync routine started at ' + Date().toString())
    function restartInFive() {
        // setTimeout(function(){debug('4')}, 1*1000)
        // setTimeout(function(){debug('3')}, 2*1000)
        // setTimeout(function(){debug('2')}, 3*1000)
        // setTimeout(function(){debug('1')}, 4*1000)
        // debug('Restarting routine in 5')
        setTimeout(function() {
            routine(routineCB)
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
            debug('Got updates from PL')
            routineCB(null, 'Got updates from PL')
        }
        debug('Restarting PL-Sync routine in ' + FETCH_DELAY_MS/1000 + ' sec.')
        setTimeout(function() {
            restartInFive()
        }, FETCH_DELAY_MS - 5*1000)
    })
}

function preloadIdMapping(callback) {
    debug('PL sync preloader started at ' + Date().toString())
    async.forEachOfSeries(mapPlDefinitions, function iterator(eValue, plDefinition, callback) {
        debug('loading from Entu ', eValue.parentEid, eValue.eDefinition)
        entu.getChilds(eValue.parentEid, eValue.eDefinition, null, null)
        .then(function(opEntities) {
            debug('loaded from Entu ' + opEntities.length)
            async.each(opEntities, function(opEntity, callback) {
                if (opEntity.get(['properties', 'pl-id', 'value'], false) !== false) {
                    op.set(mapPL2Entu, String(opEntity.get(['properties', 'pl-id', 'value'])), String(opEntity.get(['id'])))
                }
                callback()
            }, function(err) {
                if (err) { return callback(err) }
                debug('Existing ' + eValue.eDefinition + 's mapped to PL id\'s')
                callback()
            })
        })
    }, function finalCB(err) {
        if (err) { return callback(err) }
        debug('Existing entities mapped to PL id\'s')
        debug('PL sync preloader finished at ' + Date().toString())
        callback()
    })
}

function startRoutine(startRoutineCB) {
    async.series([
        function preloader(callback) {
            preloadIdMapping(callback)
        },
        function runRoutine(callback) {
            routine(startRoutineCB)
            callback()
        }
    ], function(err) {
        if (err) { return startRoutineCB(err) }
        debug('PL sync routine started.')
    })
}
module.exports.routine = startRoutine
module.exports.state = state
