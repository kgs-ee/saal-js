var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')

console.log('Caching Started at ' + Date().toString())

var entu      = require('../helpers/entu')
// var rearrange = require('../helpers/rearrange')

CACHE_REFRESH_MS = 10 * 60 * 1000

SDC = op({
    'mappings': {'festival': 1930},
    'root': {},
    'local_entities': {},
    'relationships': {},
})

var cacheFromEntu = [
    {'parent':'1976',                            'definition': 'category',    'class': 'category'},
    {'parent':'2786',                            'definition': 'category',    'class': 'category'},
    {'parent':SDC.get(['mappings', 'festival']), 'definition': 'event',       'class': 'festival'},
    {'parent':'597',                             'definition': 'event',       'class': 'program'},
    {'parent':'1931',                            'definition': 'event',       'class': 'residency'},
    {'parent':'1929',                            'definition': 'event',       'class': 'tour'},
    {'parent':'1953',                            'definition': 'news',        'class': 'news'},
    {'parent':'1918',                            'definition': 'person',      'class': 'team'},
    {'parent':'1935',                            'definition': 'performance', 'class': 'performance'},
    {'parent':'2109',                            'definition': 'location',    'class': 'location'},
    {'parent':'2107',                            'definition': 'event',       'class': 'project'},
    {'parent':'1',                               'definition': 'banner',      'class': 'supporters'},
    {'parent':'2786',                            'definition': 'banner-type', 'class': 'banner types'},
    // {                 'definition': 'coverage',    'class': 'coverage'},
]
var cacheFromPL = {
    'category': 1976,
    'concert': 597, // event
    'show': 1935 // performance
}

var PLLanguages = ['est', 'eng']
var PLData = {}
var tempLocalEntities = {}
var tempRelationships = {}

var cacheSeries = []
var immediateReloadRequired = false
var isPublished = false
var firstRun = true


// Preload with stored data
cacheSeries.push(function loadCache(callback) {
    console.log('Loading local cache')
    // debug(Object.keys(SDC.get()))
    var mandatoryFilenames = Object.keys(SDC.get())
    var existingFilenames = fs.readdirSync(APP_CACHE_DIR).map(function(filename) {
        return filename.split('.json')[0]
    })
    var filenames = existingFilenames.concat(mandatoryFilenames.filter(function(item) {
        return existingFilenames.indexOf(item) < 0
    }))

    async.each(filenames, function(filename, callback) {
        try {
            SDC.set(filename, require(path.join(APP_CACHE_DIR, filename)))
        } catch(err) {
            console.log('Not loaded: ', filename)
            op.del(filenames, filenames.indexOf(filename))
        }
        callback()
    }, function(err) {
        if (err) {
            callback(err)
            return
        }
        console.log('Cache loaded.')
        callback()
    })
})


// Cache root elements
cacheSeries.push(function cacheRoot(callback) {
    debug('Caching root')
    SDC.set(['root', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
    entu.get_entity(APP_ENTU_ROOT, null, null, function(err, institution) {
        if (err) {
            console.log('Caching root failed', err)
            callback(err)
            return
        }
        SDC.set(['root', 'main_color'], institution.get(['properties', 'main-color', 'value']))
        SDC.set(['root', 'secondary_color'], institution.get(['properties', 'secondary-color', 'value']))
        SDC.set(['root', 'description'], institution.get(['properties', 'description', 'md']))
        SDC.set(['root', 'gallery'], institution.get(['properties', 'photo']))
        isPublished = institution.get(['properties', 'published', 'value'], false) === 'True'
        var publishedPid = institution.get(['properties', 'published', 'id'], false)
        // SDC.set(['root', 'published'], isPublished)
        // console.log('Root cached', institution.get(['properties', 'published']))
        if (firstRun === true) {
            return callback()
        } else if (isPublished) {
            var params = {
                entity_id: APP_ENTU_ROOT,
                entity_definition: 'institution',
                dataproperty: 'published',
                property_id: publishedPid,
                new_value: ''
            }
            entu.edit(params, function() {
                console.log('Is published')
                return callback()
            })

        } else {
            // console.log('Is NOT published')
            callback('Not published')
        }
    })
})


// Fetch from Piletilevi
cacheSeries.push(function fetchFromPL(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Fetch from Piletilevi"')
        callback()
        return
    }
    console.log('Fetch from Piletilevi')
    var url = 'http://www.piletilevi.ee/api/action/filter/?types=category,show,concert,venue&export=venue&order=date,desc&filter=venueId/245;concertActive&limit=10000&start=0&language='
    async.each(PLLanguages, function(PLLanguage, callback) {
        request({
            url: url + PLLanguage,
            json: true,
            timeout: 10 * 1000
        }, function (error, response, body) {
            if (error) {
                console.log('PL responded with ', error)
                callback()
            } else if (response.statusCode !== 200) {
                console.log('Response status for language ' + PLLanguage + ': ' + response.statusCode)
                callback()
            } else {
                op.set(PLData, PLLanguage, body.responseData)
                callback()
            }
        })
    }, function(err) {
        if (err) {
            console.log('Each failed for fetch from PL')
            callback(err)
            return
        }
        callback()
    })
})

var PLCategories = {}
var PLShows = {}
var PLConcerts = {}

// Parse PL data
cacheSeries.push(function parsePLData(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Parse Piletilevi data"')
        callback()
        return
    }
    console.log('Parse Piletilevi data')
    async.each(PLLanguages, function(PLLanguage, callback) {
        async.each(Object.keys(cacheFromPL), function(PLDefinition, callback) {
            async.each(op.get(PLData, [PLLanguage, PLDefinition], []), function(item, callback) {
                // console.log(JSON.stringify(item, null, 2), PLDefinition)
                switch (PLDefinition) {
                    case 'category':
                        op.set(PLCategories, [item.id, 'id'], item.id)
                        op.set(PLCategories, [item.id, 'parent'], item.parentCategoryId)
                        op.set(PLCategories, [item.id, 'title', PLLanguage], item.title)
                        break
                    case 'concert':
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
                        var descriptionLanguages = item.descriptionLanguages.split(',')
                        var translatedLang = false
                        for (i in descriptionLanguages) {
                            if (descriptionLanguages[i] === PLLanguage) {
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
                            op.set(PLShows, [item.id, 'title', PLLanguage], item.title)
                            op.set(PLShows, [item.id, 'description', PLLanguage], item.description)
                            op.set(PLShows, [item.id, 'purchaseDescription', PLLanguage], item.purchaseDescription)
                        }
                        break
                }
                callback()
            }, function(err) {
                if (err) {
                    console.log('Each failed for parse PL definition: ' + PLDefinition)
                    callback(err)
                    return
                }
                // console.log('Each succeeded for parse PL definitions for language: ' + PLLanguage)
                callback()
            })
        }, function(err) {
            if (err) {
                console.log('Each failed for parse PL data')
                callback(err)
                return
            }
            // console.log('Each succeeded for parse PL languages')
            callback()
        })
    }, function(err) {
        if (err) {
            console.log('Each failed for parse PL data')
            callback(err)
            return
        }
        console.log('Each succeeded for parse PL data')
        callback()
    })
})


function add2cache(entity, eClass) {
    op.set(tempLocalEntities, ['by_eid', String(entity.id)], entity)
    if (eClass) {
        op.set(tempLocalEntities, ['by_class', eClass, String(entity.id)], entity)
    }
    op.set(tempLocalEntities, ['by_definition', entity.definition, String(entity.id)], entity)
    var plId = op.get(entity, 'properties.pl-id.value', false)
    if (plId) {
        op.set(tempLocalEntities, ['by_plid', String(plId)], entity)
    }

    if (op.get(entity, ['properties', 'featured', 'value']) === 'True') {
        if (op.get(entity, ['definition']) === 'performance') {
            op.set(tempLocalEntities, ['featured', String(entity.id)], entity)
        }
    }
    return
}
function relate(eid1, rel1, eid2, rel2) {
    if (op.get(tempRelationships, [String(eid1), rel1], []).indexOf(String(eid2)) === -1) {
        op.push(tempRelationships, [String(eid1), rel1], String(eid2))
    }
    if (rel2) {
        if (op.get(tempRelationships, [String(eid2), rel2], []).indexOf(String(eid1)) === -1) {
            op.push(tempRelationships, [String(eid2), rel2], String(eid1))
        }
    }
}
function cacheBanner(opEntity, callback) {
    var bannerTypes = opEntity.get(['properties', 'type'])
    // debug(JSON.stringify(bannerTypes, null, 4))
    bannerTypes.forEach(function(bannerType) {
        // debug(JSON.stringify(bannerType, null, 4))
        relate(bannerType.reference, 'banner', opEntity.get(['id']), 'type')
    })
    callback()
}
function cacheCategory(opEntity, callback) {
    var plId = opEntity.get('properties.pl-id.value', false)
    if (plId) {
        op.del(PLCategories, plId)
    }
    callback()
}
function cachePerformance(opEntity, callback) {
    var plId = opEntity.get('properties.pl-id.value', false)
    if (plId) {
        op.del(PLShows, plId)
    }
    var perfRef = opEntity.get('properties.premiere.reference', false)
    if (perfRef) {
        relate(opEntity.get('id'), 'premiere', perfRef, 'performance')
    }
    var parentEid = opEntity.get('id')
    entu.get_childs(parentEid, null, null, null, function(err, entities) {
        if (err) {
            // console.log('Fetch childs: ' + definition + '@' + parentEid + ' from Entu failed.', err)
            callback(err)
            return
        }
        async.each(entities, function(opEntity, callback) {
            var entity = opEntity.get()
            relate(entity.id, 'parent', parentEid, entity.definition)
            add2cache(entity)
            callback()
        }, function(err) {
            if (err) {
                console.log('Each failed for childs of ' + parentEid)
                callback(err)
                return
            }
            // console.log('Each succeeded for childs of ' + parentEid)
            callback()
        })
    })
}
function cacheEvent(opEntity, callback) {
    var plId = opEntity.get('properties.pl-id.value', false)
    if (plId) {
        // TODO: Merge ticket information from PLConcert ...
        //       sales-time
        //       sales-status
        //       min-price
        //       max-price
        // ... and remove from PL
        op.del(PLConcerts, plId)
    }
    var perfRef = opEntity.get('properties.performance.reference', false)
    if (perfRef) {
        relate(opEntity.get('id'), 'performance', perfRef, 'event')
    }
    var parentEid = opEntity.get('id')
    entu.get_childs(parentEid, null, null, null, function(err, entities) {
        if (err) {
            // console.log('Fetch childs: ' + definition + '@' + parentEid + ' from Entu failed.', err)
            callback(err)
            return
        }
        // if (!eClass) {
        //     eClass = op.get(festivals, String(parentEid))
        // }
        async.each(entities, function(opEntity, callback) {
            var entity = opEntity.get()
            relate(entity.id, 'parent', parentEid, entity.definition)

            add2cache(entity)
            if (opEntity.get('definition') === 'event') {
                cacheEvent(opEntity, callback)
            } else {
                callback()
            }
        }, function(err) {
            if (err) {
                console.log('Each failed for childs of ' + parentEid)
                callback(err)
                return
            }
            // console.log('Each succeeded for childs of ' + parentEid)
            callback()
        })
    })
}

// Fetch from Entu and remove from PLData if exists
cacheSeries.push(function fetchFromEntu(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Fetch from Entu and remove from PLData if exists"')
        callback()
        return
    }
    console.log('Fetch from Entu and remove from PLData if exists')

    function myProcessEntities(parentEid, eClass, definition, entities, callback) {
        async.each(entities, function(opEntity, callback) {
            var entity = opEntity.get()
            if (parentEid) {
                if (op.get(tempRelationships, [String(entity.id), 'parent'], []).indexOf(String(parentEid)) === -1) {
                    op.push(tempRelationships, [String(entity.id), 'parent'], String(parentEid))
                }
                if (op.get(tempRelationships, [String(parentEid), 'child'], []).indexOf(String(entity.id)) === -1) {
                    op.push(tempRelationships, [String(parentEid), 'child'], String(entity.id))
                }
            }

            add2cache(entity, eClass)
            switch (definition) {
                case 'category':
                    cacheCategory(opEntity, callback)
                    break
                case 'event':
                    cacheEvent(opEntity, callback)
                    break
                case 'performance':
                    cachePerformance(opEntity, callback)
                    break
                case 'news':
                    callback()
                    break
                case 'person':
                    callback()
                    break
                case 'location':
                    callback()
                    break
                case 'banner-type':
                    callback()
                    break
                case 'banner':
                    cacheBanner(opEntity, callback)
                    break
                default:
                    console.log('Unhandled definition: ' + definition)
                    break
            }
            // console.log(opEntity.get('id'))
        }, function(err) {
            if (err) {
                console.log('Each failed for myProcessEntities')
                callback(err)
                return
            }
            callback()
        })
    }

    async.eachLimit(cacheFromEntu, 1, function(options, callback) {
        var definition = options.definition
        var eClass = options.class
        console.log('Fetch ' + JSON.stringify(options) + ' from Entu.')
        if (options.parent) {
            var parentEid = options.parent
            // console.log('Fetch ' + definition + '@' + parentEid + ' from Entu.')
            entu.get_childs(parentEid, definition, null, null, function(err, opEntities) {
                if (err) {
                    console.log('Fetch ' + definition + '@' + parentEid + ' from Entu failed.', err)
                    callback(err)
                    return
                }
                // console.log('Fetch ' + definition + '@' + parentEid + ' from Entu succeeded.')
                myProcessEntities(parentEid, eClass, definition, opEntities, callback)
            })
        } else {
            // console.log('Fetch ' + definition + '@' + JSON.stringify(options) + ' from Entu.')
            entu.get_entities(definition, null, null, null, function(err, opEntities) {
                if (err) {
                    console.log('Fetch ' + definition + ' from Entu failed.', err)
                    callback(err)
                    return
                }
                // console.log('Fetch ' + definition + '@' + parentEid + ' from Entu succeeded.')
                myProcessEntities(null, eClass, definition, opEntities, callback)
            })
        }
    }, function(err) {
        if (err) {
            console.log('Each failed for fetch from Entu')
            callback(err)
            return
        }
        // console.log('Each succeeded for fetch from Entu')
        // console.log(JSON.stringify(PLCategories, null, 2))
        // fs.createWriteStream(path.join(APP_CACHE_DIR, 'PL.json')).write(JSON.stringify({'category':PLCategories, 'performance':PLShows, 'event':PLConcerts}, null, '    '), callback)
        callback()
    })
})


// Add missing categories to Entu
cacheSeries.push(function addCategories2Entu(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Add new categories to Entu"')
        callback()
        return
    }
    if (Object.keys(PLCategories).length === 0) {
        // console.log('no categories')
        callback()
        return
    }
    console.log('Add new categories to Entu. (' + Object.keys(PLCategories).length + ')')

    immediateReloadRequired = true

    async.each(PLCategories, function(PLCategory, callback) {
        var properties = {
            'pl-id': parseInt(PLCategory.id, 10),
            'et-name': op.get(PLCategory, 'title.est'),
            'en-name': op.get(PLCategory, 'title.eng')
        }
        entu.add(cacheFromPL.category, 'category', properties, null, null, function categoryAddedCB(err, newId) {
            if (err) {
                console.log('Entu failed to add category', err)
                callback(err)
                return
            }
            console.log('Entu added category ' + newId)
            callback()
        })

    }, function(err) {
        if (err) {
            console.log('Each failed for add missing categories')
            callback(err)
            return
        }
        // console.log('Missing categories added.')
        callback()
    })
})
// Add missing performances to Entu
cacheSeries.push(function addPerformances2Entu(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Add new performances to Entu"')
        callback()
        return
    }
    if (Object.keys(PLShows).length === 0) {
        callback()
        return
    }
    console.log('Add new performances to Entu. (' + Object.keys(PLShows).length + ')')
    immediateReloadRequired = true

    async.each(PLShows, function(PLShow, callback) {
        // console.log(op.get(PLShow, 'category'))
        // console.log(op.get(PLShow, 'category').map(function(id) {return tempLocalEntities.by_plid[id].id}))
        var properties = {
            'pl-id': parseInt(PLShow.id, 10),
            'category': op.get(PLShow, 'category', []).map(function(id) {return op.get(tempLocalEntities, ['by_plid', id, 'id'])})[0],
            'et-name': op.get(PLShow, 'title.est'),
            'en-name': op.get(PLShow, 'title.eng'),
            'et-purchase-description': op.get(PLShow, 'purchaseDescription.est'),
            'en-purchase-description': op.get(PLShow, 'purchaseDescription.eng'),
            'et-description': op.get(PLShow, 'description.est'),
            'en-description': op.get(PLShow, 'description.eng'),
            'photo-url': op.get(PLShow, 'originalImageUrl'),
            'thumb-url': op.get(PLShow, 'shortImageUrl'),
        }
        // console.log(JSON.stringify(properties, null, 2))
        entu.add(cacheFromPL.show, 'performance', properties, null, null, function performanceAddedCB(err, newId) {
            if (err) {
                console.log('Entu failed to add performance', err)
                callback(err)
                return
            }
            console.log('Entu added performance ' + newId, err)
            callback()
        })

    }, function(err) {
        if (err) {
            console.log('Each failed for add missing performances')
            callback(err)
            return
        }
        // console.log('Missing performances added.')
        callback()
    })
})
// Add missing events to Entu
cacheSeries.push(function addEvents2Entu(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Add new events to Entu"')
        callback()
        return
    }
    if (Object.keys(PLConcerts).length === 0) {
        callback()
        return
    }
    console.log('Add new events to Entu. (' + Object.keys(PLConcerts).length + ')')
    immediateReloadRequired = true

    async.eachLimit(PLConcerts, 1, function(PLConcert, callback) {
        var startTime = new Date(op.get(PLConcert, 'startTimestamp')*1000)
        var endTime = new Date(op.get(PLConcert, 'endTimestamp')*1000)
        var salesTime = new Date(op.get(PLConcert, 'salesTimestamp')*1000)
        var properties = {
            'pl-id': parseInt(PLConcert.id, 10),
            'performance': op.get(tempLocalEntities, ['by_plid', op.get(PLConcert, 'showId'), 'id']),
            'start-time': startTime.toJSON().replace('T', ' ').slice(0,19),
            'end-time': endTime.toJSON().replace('T', ' ').slice(0,19),
            'sales-time': salesTime.toJSON().replace('T', ' ').slice(0,19),
            'sales-status': op.get(PLConcert, 'salesStatus'),
            'min-price': op.get(PLConcert, 'minPrice'),
            'max-price': op.get(PLConcert, 'maxPrice'),
        }
        // console.log(JSON.stringify(properties, null, 2))
        entu.add(cacheFromPL.concert, 'event', properties, null, null, function eventAddedCB(err, newId) {
            if (err) {
                console.log('Entu failed to add event', err)
                callback(err)
                return
            }
            console.log('Entu added event ' + newId, err)
            callback()
        })

    }, function(err) {
        if (err) {
            console.log('Each failed for add missing events')
            callback(err)
            return
        }
        // console.log('Missing events added.')
        callback()
    })
})

// Save cache
cacheSeries.push(function saveCache(callback) {
    if (immediateReloadRequired) {
        console.log('Skipping "Save Cache"')
        callback()
        return
    }
    console.log('Save Cache')
    SDC.set('local_entities', tempLocalEntities)
    SDC.set('relationships', tempRelationships)



    async.each(Object.keys(SDC.get()), function(filename, callback) {
        console.log('Saving ' + filename)
        var entitiesWs = fs.createWriteStream(path.join(APP_CACHE_DIR, filename + '.json'))
        entitiesWs.write(JSON.stringify(SDC.get(filename), null, 4), callback)
    }, function(err) {
        if (err) {
            console.log('Saving cache failed', err)
            callback(err)
            return
        }
        console.log('cache saved')
        firstRun = false
        callback()
    })
})


// Final cleanup
cacheSeries.push(function cleanup(callback) {
    tempLocalEntities = {}
    tempRelationships = {}
    PLCategories = {}
    PLShows = {}
    PLConcerts = {}
    callback()
})




function routine(WorkerReloadCB) {
    console.log('Cache routine started')
    function restartInFive() {
        setTimeout(function(){console.log('4')}, 1*1000)
        setTimeout(function(){console.log('3')}, 2*1000)
        setTimeout(function(){console.log('2')}, 3*1000)
        setTimeout(function(){console.log('1')}, 4*1000)
        console.log('Restarting routine in 5')
        setTimeout(function() {
            routine(WorkerReloadCB)
        }, 5*1000)
        WorkerReloadCB()
    }
    async.series(cacheSeries, function routineFinally(err) {
        if (err === 'Not published') {
            console.log('No news. Restarting routine in ' + CACHE_REFRESH_MS/1000 + ' sec.')
            setTimeout(function() {
                restartInFive()
            }, CACHE_REFRESH_MS - 5*1000)
            return
        }
        else if (err) {
            console.log('Routine stumbled. Restart in 25', err)
            setTimeout(function() {
                restartInFive()
            }, 20*1000)
            return
        }
        if (immediateReloadRequired) {
            immediateReloadRequired = false
            console.log('Immediate reload requested')
            restartInFive()
            return
        }
        WorkerReloadCB() // Routine finished successfully - tell workers to reload.
        console.log('Restarting routine in ' + CACHE_REFRESH_MS/1000 + ' sec.')
        setTimeout(function() {
            restartInFive()
        }, CACHE_REFRESH_MS - 5*1000)
    })
}
module.exports.routine = routine
