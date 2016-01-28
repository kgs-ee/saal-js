var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
// var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')

debug('Caching Started at ' + Date().toString())

var entu      = require('../helpers/entu')
// var rearrange = require('../helpers/rearrange')

CACHE_REFRESH_MS = 1 * 60e3

var state = 'idle'

SDC = op({
    'mappings': {'festival': 1930},
    'root': {},
    'local_entities': {},
    'relationships': {},
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

var tempLocalEntities = {}
var tempRelationships = {}

var cacheSeries = []
var immediateReloadRequired = false
var syncRequested = false
var isPublished = false
var firstRun = true


// Preload with stored data
cacheSeries.push(function loadCache(callback) {
    state = 'busy'
    debug('Loading local cache at ' + Date().toString())
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
            // debug('Not loaded: ', filename)
            op.del(filenames, filenames.indexOf(filename))
        }
        callback()
    }, function(err) {
        if (err) {
            callback(err)
            return
        }
        // debug('Cache loaded.')
        callback()
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
        isPublished = institution.get(['properties', 'published', 'value'], false) === 'True'
        var publishedPid = institution.get(['properties', 'published', 'id'], false)
        // SDC.set(['root', 'published'], isPublished)
        debug('Root cached, ' + (isPublished ? 'we have news published.' : 'reload not requested.'))
        if (firstRun === true) {
            debug('1st run.')
            return callback()
        } else if (syncRequested === true) {
            syncRequested = false
            return callback()
        } else if (isPublished) {
            var params = {
                entity_id: APP_ENTU_ROOT,
                entity_definition: 'institution',
                dataproperty: 'published',
                property_id: publishedPid,
                new_value: ''
            }
            entu.edit(params).then(callback)
        } else {
            debug('Is NOT published')
            callback('Not published')
        }
    })
})


function add2cache(entity, eClass) {
    op.set(tempLocalEntities, ['by_eid', String(entity.id)], entity)
    if (eClass) {
        op.set(tempLocalEntities, ['by_class', eClass, String(entity.id)], entity)
    }
    op.set(tempLocalEntities, ['by_definition', entity.definition, String(entity.id)], entity)
    // var plId = op.get(entity, 'properties.pl-id.value', false)
    // if (plId) {
    //     op.set(tempLocalEntities, ['by_plid', String(plId)], entity)
    // }

    if (op.get(entity, ['properties', 'featured', 'value']) === 'True') {
        if (op.get(entity, ['definition']) === 'performance') {
            op.set(tempLocalEntities, ['featured', String(entity.id)], entity)
        }
    }
    return
}

// Fetch from Entu
cacheSeries.push(function fetchFromEntu(callback) {
    if (immediateReloadRequired) {
        debug('Skipping "Fetch from Entu" at ' + Date().toString())
        return callback()
    }
    // debug('Fetch from Entu at ' + Date().toString())

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
                    var parentCategoryRefs = op.get(tempRelationships, [String(categoryRef), 'parent'], [])
                    parentCategoryRefs.forEach(function(parentCategoryRef) {
                        var parentDef = op.get(tempLocalEntities, ['by_eid', String(parentCategoryRef), 'definition'], null)
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
                    var parentCategoryRefs = op.get(tempRelationships, [String(categoryRef), 'parent'], [])
                    // debug('!!! parentCategoryRefs', parentCategoryRefs)
                    parentCategoryRefs.forEach(function(parentCategoryRef) {
                        var parentDef = op.get(tempLocalEntities, ['by_eid', String(parentCategoryRef), 'definition'], null)
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
                    var parentCategoryRefs = op.get(tempRelationships, [String(categoryRef), 'parent'], [])
                    parentCategoryRefs.forEach(function(parentCategoryRef) {
                        var parentDef = op.get(tempLocalEntities, ['by_eid', String(parentCategoryRef), 'definition'], null)
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


    function myProcessEntities(parentEid, eClass, definition, entities, callback) {
        if (entities.length === 0) { return callback() }
        // debug('Processing ' + entities.length + ' entities (' + eClass + '|' + definition + ').')
        async.each(entities, function(opEntity, callback) {
            if (opEntity.get(['properties', 'nopublish', 'value']) === 'True') {
                return callback(null)
            }
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


// Save cache
cacheSeries.push(function saveCache(callback) {
    if (immediateReloadRequired) {
        debug('Skipping "Save Cache" at ' + Date().toString())
        callback()
        return
    }
    debug('Save Cache at ' + Date().toString())
    SDC.set('local_entities', tempLocalEntities)
    SDC.set('relationships', tempRelationships)
    SDC.set('date', Date().toString())



    async.each(Object.keys(SDC.get()), function(filename, callback) {
        // debug('Saving ' + filename)
        fs.writeFile(path.join(APP_CACHE_DIR, filename + '.json'), JSON.stringify(SDC.get(filename), null, 4), (err) => {
            if (err) { return callback(err) }
            callback()
        })
        // var entitiesWs = fs.createWriteStream(path.join(APP_CACHE_DIR, filename + '.json'))
        // entitiesWs.write(JSON.stringify(SDC.get(filename), null, 4), callback)
    }, function(err) {
        if (err) {
            debug('Saving cache failed', err)
            return callback(err)
        }
        debug('Cache saved as of ' + SDC.get('date') )
        firstRun = false
        callback()
    })
})


// Final cleanup
cacheSeries.push(function cleanup(callback) {
    tempLocalEntities = {}
    tempRelationships = {}
    callback()
    state = 'sleeping'
})




function routine(WorkerReloadCB) {
    debug('Cache routine started at ' + Date().toString())
    var routineBusy = false
    var routineTimeOut

    function restartInFive() {
        // setTimeout(function(){debug('4')}, 1e3)
        // setTimeout(function(){debug('3')}, 2e3)
        // setTimeout(function(){debug('2')}, 3e3)
        // setTimeout(function(){debug('1')}, 4e3)
        // debug('Restarting routine in 5')
        setTimeout(function() {
            performSync()
        }, 5e3)
        // WorkerReloadCB()
    }
    function performSync() {
        if (routineBusy) {
            debug('routineBusy')
            return 'routineBusy'
        }
        debug('Performing cache sync routine at ' + Date().toString())
        routineBusy = true
        clearTimeout(routineTimeOut)
        async.series(cacheSeries, function routineFinally(err) {
            if (err === 'Not published') {
                debug('No news. Restarting routine in ' + CACHE_REFRESH_MS/1000 + ' sec.')
                routineBusy = false
                routineTimeOut = setTimeout(function() {
                    restartInFive()
                }, CACHE_REFRESH_MS - 5e3)
                return
            }
            else if (err) {
                debug('Routine stumbled. Restart in 25', err)
                routineBusy = false
                routineTimeOut = setTimeout(function() {
                    restartInFive()
                }, 20e3)
                return
            }
            if (immediateReloadRequired) {
                immediateReloadRequired = false
                debug('Immediate reload requested at ' + Date().toString())
                restartInFive()
                return
            }
            WorkerReloadCB() // Routine finished successfully - tell workers to reload.
            debug('Restarting cache routine in ' + CACHE_REFRESH_MS/1000 + ' sec.')
            routineBusy = false
            routineTimeOut = setTimeout(function() {
                restartInFive()
            }, CACHE_REFRESH_MS - 5e3)
        })
    }

    performSync()

    function requestSync() {
        debug('Sync request acknowledged at ' + Date().toString())
        syncRequested = true
        if (performSync() === 'routineBusy') {
            debug('Request immediate reload at ' + Date().toString())
            immediateReloadRequired = true
        }
    }

    return {
        requestSync: requestSync
    }
}


module.exports.routine = routine
module.exports.state = state
// module.exports.requestSync = requestSync
