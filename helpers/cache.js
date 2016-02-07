var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
// var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')

debug('Caching Started at ' + Date().toString())

var entu      = require('../helpers/entu')
// var rearrange = require('../helpers/rearrange')

POLLING_INTERVAL_MS = 3e3
CACHE_LOADED_MESSAGE = 'Cache successfully loaded'
CACHE_RELOAD_REQUIRED_MESSAGE = 'Full cache reload required'

var state = 'idle'

SDC = op({
    'mappings': {'festival': 1930},
    'root': {},
    'local_entities': {},
    'relationships': {},
    'lastPollTs': 0,
    // 'lastPollTs': new Date().getTime() / 1e3,
})

var cacheFromEntu = [
    {'parent':'3808',                            'definition': 'category',    'class': 'rootCategory'},
    {'parent':SDC.get(['mappings', 'festival']), 'definition': 'event',       'class': 'festival'},
    {'parent':'597',                             'definition': 'event',       'class': 'program'},
    {'parent':'1931',                            'definition': 'event',       'class': 'residency'},
    {'parent':'1929',                            'definition': 'event',       'class': 'tour'},
    {'parent':'1953',                            'definition': 'news',        'class': 'news'},
    {'parent':'4051',                            'definition': 'person',      'class': 'team'},
    {'parent':'1935',                            'definition': 'performance', 'class': 'performance'},
    {'parent':'2109',                            'definition': 'location',    'class': 'location'},
    {'parent':'2107',                            'definition': 'event',       'class': 'project'},
    {'parent':'1',                               'definition': 'banner',      'class': 'supporters'},
    {'parent':'2786',                            'definition': 'banner-type', 'class': 'banner types'},
    {'parent':'4024',                            'definition': 'echo',        'class': 'echo'},
    {'parent':'4024',                            'definition': 'category',    'class': 'echoCategory'},
]

// var tempLocalEntities = {}
// var tempRelationships = {}

var cacheSeries = []


// Preload with stored data
cacheSeries.push(function loadCache(callback) {
    state = 'busy'
    debug('Loading local cache at ' + Date().toString())
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
            debug('Missing ' + filename + ' - ' + CACHE_RELOAD_REQUIRED_MESSAGE)
            return callback(CACHE_RELOAD_REQUIRED_MESSAGE)
        }
        callback()
    }, function(err) {
        if (err === CACHE_RELOAD_REQUIRED_MESSAGE) { return callback() }
        if (err) { throw err }
        // debug('Cache loaded.')
        callback(CACHE_LOADED_MESSAGE)
    })
})


// Cache root elements
cacheSeries.push(function cacheRoot(callback) {
    debug('Caching root at ' + Date().toString())
    SDC.set(['root', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
    entu.getEntity(APP_ENTU_ROOT, null, null)
    .then(function(institution) {
        SDC.set(['root', 'main_color'], institution.get(['properties', 'main-color', 'value']))
        SDC.set(['root', 'secondary_color'], institution.get(['properties', 'secondary-color', 'value']))
        SDC.set(['root', 'description'], institution.get(['properties', 'description', 'md']))
        SDC.set(['root', 'gallery'], institution.get(['properties', 'photo']))
        return callback()
    })
})


function add2cache(entity, eClass) {
    SDC.set(['local_entities', 'by_eid', String(entity.id)], entity)
    if (eClass) {
        SDC.set(['local_entities', 'by_class', eClass, String(entity.id)], entity)
    }
    SDC.set(['local_entities', 'by_definition', entity.definition, String(entity.id)], entity)

    if (op.get(entity, ['properties', 'featured', 'value']) === 'True') {
        if (op.get(entity, ['definition']) === 'performance') {
            SDC.set(['local_entities', 'featured', String(entity.id)], entity)
        }
    }
    return
}


function myProcessEntities(parentEid, eClass, definition, entities, callback) {
    function relate(eid1, rel1, eid2, rel2) {
        if (SDC.get(['relationships', String(eid1), rel1], []).indexOf(String(eid2)) === -1) {
            SDC.push(['relationships', String(eid1), rel1], String(eid2))
        }
        if (rel2) {
            if (SDC.get(['relationships', String(eid2), rel2], []).indexOf(String(eid1)) === -1) {
                SDC.push(['relationships', String(eid2), rel2], String(eid1))
            }
        }
    }
    function cacheBanner(opEntity, callback) {
        var bannerTypes = opEntity.get(['properties', 'type'], [])
        // debug(JSON.stringify(bannerTypes, null, 4))
        bannerTypes.forEach(function(bannerType) {
            // debug(JSON.stringify(bannerType, null, 4))
            relate(bannerType.reference, 'banner', opEntity.get(['id']), 'type')
        })
        callback()
    }
    function cacheEcho(opEntity, callback) {
        var categoryRefs = opEntity.get(['properties', 'category'], [])
        categoryRefs.forEach(function(categoryRef) {
            categoryRef = categoryRef.reference
            if (categoryRef) {
                function relateParents(categoryRef) {
                    var parentCategoryRefs = SDC.get(['relationships', String(categoryRef), 'parent'], [])
                    parentCategoryRefs.forEach(function(parentCategoryRef) {
                        var parentDef = SDC.get(['local_entities', 'by_eid', String(parentCategoryRef), 'definition'], null)
                        if (parentDef === 'category') {
                            relateParents(parentCategoryRef)
                            relate(opEntity.get('id'), 'category', parentCategoryRef, 'echo')
                        }
                    })
                }
                relate(opEntity.get('id'), 'category', categoryRef, 'echo')
                relateParents(categoryRef)
            }
        })
        callback()
    }
    function cacheCategory(opEntity, eClass, definition, callback) {
        // debug('!!! Cacheing ', opEntity.get('id'), eClass, definition)
        var parentEid = opEntity.get('id')
        entu.getChilds(parentEid, definition, null, null)
        .then(function(opEntities) {
            // debug('!!! Fetch ' + definition + '@' + parentEid + ' from Entu succeeded.')
            myProcessEntities(parentEid, definition, definition, opEntities, callback)
        })
    }
    function cachePerformance(opEntity, callback) {
        var perfRef = opEntity.get('properties.premiere.reference', false)
        if (perfRef) {
            relate(opEntity.get('id'), 'premiere', perfRef, 'performance')
        }

        // Relate all related categories
        var categoryRefs = opEntity.get(['properties', 'category'], [])
        categoryRefs.forEach(function(categoryRef) {
            categoryRef = categoryRef.reference
            // var categoryRef = opEntity.get(['properties', 'category', 'reference'], false)
            // debug('cachePerformance ' + opEntity.get('id'), categoryRef)
            if (categoryRef) {
                function relateParents(categoryRef) {
                    var parentCategoryRefs = SDC.get(['relationships', String(categoryRef), 'parent'], [])
                    // debug('!!! parentCategoryRefs', parentCategoryRefs)
                    parentCategoryRefs.forEach(function(parentCategoryRef) {
                        var parentDef = SDC.get(['local_entities', 'by_eid', String(parentCategoryRef), 'definition'], null)
                        if (parentDef === 'category') {
                            // debug('relate', opEntity.get('id'), 'category', parentCategoryRef, 'performance')
                            relateParents(parentCategoryRef)
                            relate(opEntity.get('id'), 'category', parentCategoryRef, 'performance')
                        }
                    })
                }
                relate(opEntity.get('id'), 'category', categoryRef, 'performance')
                relateParents(categoryRef)
            }
        })

        var parentEid = opEntity.get('id')
        entu.getChilds(parentEid, null, null, null)
        .then(function(entities) {
            async.each(entities, function(opEntity, callback) {
                if (opEntity.get(['properties', 'nopublish', 'value']) === 'True') {
                    return callback(null)
                }
                var entity = opEntity.get()
                relate(entity.id, 'parent', parentEid, entity.definition)
                add2cache(entity)
                callback()
            }, function(err) {
                if (err) {
                    debug('Each failed for childs of ' + parentEid)
                    callback(err)
                    return
                }
                // debug('Each succeeded for childs of ' + parentEid)
                callback()
            })
        })
    }
    function cacheEvent(opEntity, callback) {
        var perfRef = opEntity.get('properties.performance.reference', false)
        if (perfRef) {
            relate(opEntity.get('id'), 'performance', perfRef, 'event')
        }

        // Calculate duration of event
        var duration = (
            (   ( new Date(opEntity.get(['properties', 'end-time', 'value'], 0)) ).getTime()
                -
                ( new Date(opEntity.get(['properties', 'start-time', 'value'], 0)) ).getTime()
            ) / 1e3 / 60)
        if (duration > 0) {
            // debug(new Date(opEntity.get(['properties', 'start-time', 'value'], 0)), new Date(opEntity.get(['properties', 'end-time', 'value'], 0)))
            opEntity.set(['properties', 'duration', 'value'], duration)
        }

        // Relate all related categories
        var categoryRefs = opEntity.get(['properties', 'category'], [])
        categoryRefs.forEach(function(categoryRef) {
            categoryRef = categoryRef.reference
            if (categoryRef) {
                function relateParents(categoryRef) {
                    var parentCategoryRefs = SDC.get(['relationships', String(categoryRef), 'parent'], [])
                    parentCategoryRefs.forEach(function(parentCategoryRef) {
                        var parentDef = SDC.get(['local_entities', 'by_eid', String(parentCategoryRef), 'definition'], null)
                        if (parentDef === 'category') {
                            relateParents(parentCategoryRef)
                            relate(opEntity.get('id'), 'category', parentCategoryRef, 'event')
                        }
                    })
                }
                relate(opEntity.get('id'), 'category', categoryRef, 'event')
                relateParents(categoryRef)
            }
        })


        var parentEid = opEntity.get('id')
        entu.getChilds(parentEid, null, null, null)
        .then(function(entities) {
            async.each(entities, function(opEntity, callback) {
                if (opEntity.get(['properties', 'nopublish', 'value']) === 'True') {
                    return callback(null)
                }
                var entity = opEntity.get()
                relate(entity.id, 'parent', parentEid, entity.definition)

                add2cache(entity)
                if (opEntity.get('definition') === 'event') {
                    cacheEvent(opEntity, callback)
                } else {
                    return callback()
                }
            }, function(err) {
                if (err) {
                    debug('Each failed for childs of ' + parentEid)
                    return callback(err)
                }
                // debug('Each succeeded for childs of ' + parentEid)
                callback()
            })
        })
    }

    if (entities.length === 0) { return callback() }
    // debug('Processing ' + entities.length + ' entities (' + eClass + '|' + definition + ').')
    async.each(entities, function(opEntity, callback) {
        if (opEntity.get(['properties', 'nopublish', 'value']) === 'True') {
            return callback(null)
        }
        var entity = opEntity.get()
        if (parentEid) {
            if (SDC.get(['relationships', String(entity.id), 'parent'], []).indexOf(String(parentEid)) === -1) {
                SDC.push(['relationships', String(entity.id), 'parent'], String(parentEid))
            }
            if (SDC.get(['relationships', String(parentEid), 'child'], []).indexOf(String(entity.id)) === -1) {
                SDC.push(['relationships', String(parentEid), 'child'], String(entity.id))
            }
        }

        add2cache(entity, eClass)
        switch (definition) {
            case 'category':
                cacheCategory(opEntity, eClass, definition, callback)
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
            case 'echo':
                cacheEcho(opEntity, callback)
                break
            default:
                debug('Unhandled definition: ' + definition)
                break
        }
        // debug(opEntity.get('id'))
    }, function(err) {
        if (err) {
            debug('Each failed for myProcessEntities')
            callback(err)
            return
        }
        callback()
    })
}


// Fetch from Entu
cacheSeries.push(function fetchFromEntu(callback) {
    // debug('Fetch from Entu at ' + Date().toString())

    async.eachLimit(cacheFromEntu, 1, function(options, callback) {
        var definition = options.definition
        var eClass = options.class
        // debug('Fetch ' + JSON.stringify(options) + ' from Entu.')
        if (options.parent) {
            var parentEid = options.parent
            // debug('Fetch ' + definition + '@' + parentEid + ' from Entu.')
            entu.getChilds(parentEid, definition, null, null)
            .then(function(opEntities) {
                // debug('Fetch ' + definition + '@' + parentEid + ' from Entu succeeded.')
                myProcessEntities(parentEid, eClass, definition, opEntities, callback)
            })
        } else {
            // debug('Fetch ' + definition + '@' + JSON.stringify(options) + ' from Entu.')
            entu.getEntities(definition, null, null, null)
            .then(function(opEntities) {
                myProcessEntities(null, eClass, definition, opEntities, callback)
            })
        }
    }, function(err) {
        if (err) {
            debug('Each failed for fetch from Entu')
            return callback(err)
        }
        // debug('Each succeeded for fetch from Entu')
        callback()
    })
})


function getLastPollTs() {
    var ts = Math.max.apply(
        Math,
        Object.keys(SDC.get(['local_entities', 'by_eid'], []))
            .map(function(key) {
                return SDC.get(['local_entities', 'by_eid', key, 'changedTs'])
            })
    )
    debug('getLastPollTs: ' + ts)
    return ts
}


// Save cache
cacheSeries.push(function saveCache(callback) {
    SDC.set('lastPollTs', getLastPollTs())
    debug('Save Cache at ' + Date().toString())

    async.each(Object.keys(SDC.get()), function(filename, callback) {
        // debug('Saving ' + filename)
        fs.writeFile(path.join(APP_CACHE_DIR, filename + '.json'), JSON.stringify(SDC.get(filename), null, 4), (err) => {
            if (err) { return callback(err) }
            callback()
        })
    }, function(err) {
        if (err) {
            debug('Saving cache failed', err)
            return callback(err)
        }
        debug('Cache saved as of ' + SDC.get('date') )
        callback()
    })
})


// Final cleanup
cacheSeries.push(function cleanup(callback) {
    callback()
    state = 'sleeping'
})



function pollEntu(workerReloadCB) {
    debug('Polling Entu')
    var updated = false

    entu.pollUpdates({
        timestamp: SDC.get(['lastPollTs'], 1454661210) + 1,
        limit: 100
    }, null, null)
    .then(function(result) {
        async.each(result, function(update, callback) {
            debug(JSON.stringify(update, null, 4))
            entu.getEntity(update.id, null, null)
            .then(function(opEntity) {
                debug(opEntity.get(['id']), JSON.stringify(opEntity.get(['definition']), null, 4))
                if (SDC.get(['lastPollTs']) < update.changed_ts) {
                    SDC.set(['lastPollTs'], update.changed_ts)
                }
            })
            .then(callback)
            // try {
            //     SDC.set(filename, require(path.join(APP_CACHE_DIR, filename)))
            // } catch(err) {
            //     // debug('Not loaded: ', filename)
            //     op.del(filenames, filenames.indexOf(filename))
            // }
        }, function(err) {
            if (err) { return callback(err) }
            setTimeout(function() { pollEntu(workerReloadCB) }, POLLING_INTERVAL_MS)
            if (updated) {
                updated = false
                workerReloadCB()
            }
        })
    })
}



function performInitialSync(workerReloadCB) {
    // Set lastPollTs from freshly cached data

    debug('Performing cache sync at ' + Date().toString())
    async.series(cacheSeries, function syncFinally(err) {
        if (err === CACHE_LOADED_MESSAGE) {
            debug('*NOTE*: Cache sync succeeded. ' + CACHE_LOADED_MESSAGE)
            workerReloadCB()
            return pollEntu(workerReloadCB)
        }
        else if (err) {
            debug('*NOTE*: Cache sync stumbled. Restart in 25', err)
            return setTimeout(function() { performInitialSync(workerReloadCB) }, 25e3)
        }
        debug('*NOTE*: Cache sync succeeded. Expecting "' + CACHE_LOADED_MESSAGE + '" on next try.')
        performInitialSync(workerReloadCB)
    })
}



module.exports.sync = performInitialSync
module.exports.state = state
