var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')

debug('Caching Started at ' + Date().toString())

var entu      = require('../helpers/entu')
// var rearrange = require('../helpers/rearrange')

CACHE_REFRESH_MS = 10 * 60 * 1000

SDC = op({
    "root": {},
    "local_entities": {},
    "relationships": {},
})

var cache_from_entu = [
    {"parent":"1976", "definition": "category",    "class": "category"},
    {"parent":"1930", "definition": "event",       "class": "festival"},
    {"parent":"597",  "definition": "event",       "class": "program"},
    {"parent":"1931", "definition": "event",       "class": "residency"},
    {"parent":"1929", "definition": "event",       "class": "tour"},
    {"parent":"1953", "definition": "news",        "class": "news"},
    {"parent":"1918", "definition": "person",      "class": "team"},
    {"parent":"1935", "definition": "performance", "class": "performance"},
    {"parent":"2109", "definition": "location",    "class": "location"},
    {"parent":"2107", "definition": "event",       "class": "project"},
    {"parent":"1",    "definition": "banner",      "class": "supporters"},
    // {                 "definition": "coverage",    "class": "coverage"},
]
var cache_from_PL = {
    "category": 1976,
    "concert": 597, // event
    "show": 1935 // performance
}

var PL_languages = ['est', 'eng']
var PL_data = {}
var temp_local_entities = {}
var temp_relationships = {}

var cache_series = []
var immediate_reload_required = false


// Preload with stored data
cache_series.push(function loadCache(callback) {
    debug('Loading local cache')
    var mandatory_filenames = Object.keys(SDC.get())
    var existing_filenames = fs.readdirSync(APP_CACHE_DIR).map(function(filename) {
        return filename.split('.json')[0]
    })
    var filenames = existing_filenames.concat(mandatory_filenames.filter(function(item) {
        return existing_filenames.indexOf(item) < 0
    }))

    async.each(filenames, function(filename, callback) {
        try {
            SDC.set(filename, require(path.join(APP_CACHE_DIR, filename)))
        } catch(err) {
            debug('Not loaded: ', filename)
            op.del(filenames, filenames.indexOf(filename))
        }
        callback()
    }, function(err) {
        if (err) {
            callback(err)
            return
        }
        debug('Cache loaded.')
        callback()
    })
})


// Cache root elements
cache_series.push(function cacheRoot(callback) {
    debug('Caching root')
    SDC.set(['root', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
    entu.get_entity(id=APP_ENTU_ROOT, null, null, CB=function(err, institution) {
        if (err) {
            debug('Caching root failed', err)
            callback(err)
            return
        }
        SDC.set(['root', 'main_color'], institution.get(['properties', 'main-color', 'value']))
        SDC.set(['root', 'secondary_color'], institution.get(['properties', 'secondary-color', 'value']))
        debug('Root cached')
        callback()
    })
})


// Fetch from Piletilevi
cache_series.push(function fetchFromPL(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Fetch from Piletilevi"')
        callback()
        return
    }
    debug('Fetch from Piletilevi')
    var url = 'http://www.piletilevi.ee/api/action/filter/?types=category,show,concert,venue&export=venue&order=date,desc&filter=venueId/245;concertActive&limit=10000&start=0&language='
    async.each(PL_languages, function(PL_language, callback) {
        request({
            url: url + PL_language,
            json: true
        }, function (error, response, body) {
            if (error) {
                callback(error)
            } else if (response.statusCode !== 200) {
                callback(new Error('Response status for language ' + PL_language + ': ' + response.statusCode))
            } else {
                op.set(PL_data, PL_language, body.responseData)
                callback()
            }
        })
    }, function(err) {
        if (err) {
            debug('Each failed for fetch from PL')
            callback(err)
            return
        }
        callback()
    })
})

var PL_categories = {}
var PL_shows = {}
var PL_concerts = {}

// Parse PL data
cache_series.push(function parsePLData(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Parse Piletilevi data"')
        callback()
        return
    }
    debug('Parse Piletilevi data')
    async.each(PL_languages, function(PL_language, callback) {
        async.each(Object.keys(cache_from_PL), function(PL_definition, callback) {
            async.each(op.get(PL_data, [PL_language, PL_definition], []), function(item, callback) {
                // debug(JSON.stringify(item, null, 2), PL_definition)
                switch (PL_definition) {
                    case 'category':
                        op.set(PL_categories, [item.id, 'id'], item.id)
                        op.set(PL_categories, [item.id, 'parent'], item.parentCategoryId)
                        op.set(PL_categories, [item.id, 'title', PL_language], item.title)
                        break
                    case 'concert':
                        op.set(PL_concerts, [item.id, 'id'],             parseInt(item.id))
                        op.set(PL_concerts, [item.id, 'showId'],         parseInt(item.showId))
                        op.set(PL_concerts, [item.id, 'startTimestamp'], parseInt(item.startTime.stamp))
                        op.set(PL_concerts, [item.id, 'endTimestamp'],   parseInt(item.endTime.stamp))
                        op.set(PL_concerts, [item.id, 'salesTimestamp'], parseInt(item.salesTime.stamp))
                        op.set(PL_concerts, [item.id, 'salesStatus'],    item.salesStatus)
                        op.set(PL_concerts, [item.id, 'minPrice'],       item.minPrice)
                        op.set(PL_concerts, [item.id, 'maxPrice'],       item.maxPrice)
                        break
                    case 'show':
                        var descriptionLanguages = item.descriptionLanguages.split(',')
                        var translatedLang = false
                        for (i in descriptionLanguages) {
                            if (descriptionLanguages[i] === PL_language) {
                                translatedLang = true
                                break
                            }
                        }
                        op.set(PL_shows, [item.id, 'id'], item.id)
                        op.set(PL_shows, [item.id, 'category'], item.categories)
                        op.set(PL_shows, [item.id, 'descriptionLanguages'], item.descriptionLanguages)
                        op.set(PL_shows, [item.id, 'originalImageUrl'], item.originalImageUrl)
                        op.set(PL_shows, [item.id, 'shortImageUrl'], item.shortImageUrl)
                        if (translatedLang) {
                            op.set(PL_shows, [item.id, 'title', PL_language], item.title)
                            op.set(PL_shows, [item.id, 'description', PL_language], item.description)
                            op.set(PL_shows, [item.id, 'purchaseDescription', PL_language], item.purchaseDescription)
                        }
                        break
                }
                callback()
            }, function(err) {
                if (err) {
                    debug('Each failed for parse PL definition: ' + PL_definition)
                    callback(err)
                    return
                }
                // debug('Each succeeded for parse PL definitions for language: ' + PL_language)
                callback()
            })
        }, function(err) {
            if (err) {
                debug('Each failed for parse PL data')
                callback(err)
                return
            }
            // debug('Each succeeded for parse PL languages')
            callback()
        })
    }, function(err) {
        if (err) {
            debug('Each failed for parse PL data')
            callback(err)
            return
        }
        debug('Each succeeded for parse PL data')
        callback()
    })
})


// Fetch from Entu and remove from PL_data if exists
cache_series.push(function fetchFromEntu(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Fetch from Entu and remove from PL_data if exists"')
        callback()
        return
    }
    debug('Fetch from Entu and remove from PL_data if exists')

    var _process_entities = function _process_entities(parent_eid, e_class, definition, entities, callback) {
        async.each(entities, function(op_entity, callback) {
            var entity = op_entity.get()
            if (parent_eid) {
                if (op.get(temp_relationships, [String(entity.id), 'parent'], []).indexOf(String(parent_eid)) === -1) {
                    op.push(temp_relationships, [String(entity.id), 'parent'], String(parent_eid))
                }
                if (op.get(temp_relationships, [String(parent_eid), 'child'], []).indexOf(String(entity.id)) === -1) {
                    op.push(temp_relationships, [String(parent_eid), 'child'], String(entity.id))
                }
            }

            add2cache(entity, e_class)
            switch (definition) {
                case 'category':
                    cacheCategory(e_class, op_entity, callback)
                    break
                case 'event':
                    cacheEvent(op_entity, callback)
                    break
                case 'performance':
                    cachePerformance(e_class, op_entity, callback)
                    break
                case 'news':
                    cacheNews(e_class, op_entity, callback)
                    break
                case 'person':
                    cachePerson(e_class, op_entity, callback)
                    break
                case 'location':
                    cacheLocation(e_class, op_entity, callback)
                    break
                case 'banner':
                    cacheBanner(e_class, op_entity, callback)
                    break
                default:
                    debug('Unhandled definition: ' + definition)
                    break
            }
            // debug(op_entity.get('id'))
        }, function(err) {
            if (err) {
                debug('Each failed for _process_entities')
                callback(err)
                return
            }
            callback()
        })
    }

    async.eachLimit(cache_from_entu, 1, function(options, callback) {
        var definition = options.definition
        var e_class = options.class
        debug('Fetch ' + JSON.stringify(options) + ' from Entu.')
        if (options.parent) {
            var parent_eid = options.parent
            // debug('Fetch ' + definition + '@' + parent_eid + ' from Entu.')
            entu.get_childs(parent_eid, definition, null, null, function(err, op_entities) {
                if (err) {
                    debug('Fetch ' + definition + '@' + parent_eid + ' from Entu failed.', err)
                    callback(err)
                    return
                }
                // debug('Fetch ' + definition + '@' + parent_eid + ' from Entu succeeded.')
                _process_entities(parent_eid, e_class, definition, op_entities, callback)
            })
        } else {
            // debug('Fetch ' + definition + '@' + JSON.stringify(options) + ' from Entu.')
            entu.get_entities(definition, null, null, null, function(err, op_entities) {
                if (err) {
                    debug('Fetch ' + definition + ' from Entu failed.', err)
                    callback(err)
                    return
                }
                // debug('Fetch ' + definition + '@' + parent_eid + ' from Entu succeeded.')
                _process_entities(null, e_class, definition, op_entities, callback)
            })
        }
    }, function(err) {
        if (err) {
            debug('Each failed for fetch from Entu')
            callback(err)
            return
        }
        // debug('Each succeeded for fetch from Entu')
        // debug(JSON.stringify(PL_categories, null, 2))
        // fs.createWriteStream(path.join(APP_CACHE_DIR, 'PL.json')).write(JSON.stringify({"category":PL_categories, "performance":PL_shows, "event":PL_concerts}, null, '    '), callback)
        callback()
    })
})


// Add missing categories to Entu
cache_series.push(function addCategories2Entu(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Add new categories to Entu"')
        callback()
        return
    }
    if (Object.keys(PL_categories).length === 0) {
        // debug('no categories')
        callback()
        return
    }
    debug('Add new categories to Entu. (' + Object.keys(PL_categories).length + ')')

    immediate_reload_required = true

    async.each(PL_categories, function(PL_category, callback) {
        var properties = {
            "pl-id": parseInt(PL_category.id),
            "et-name": op.get(PL_category, 'title.est'),
            "en-name": op.get(PL_category, 'title.eng')
        }
        entu.add(cache_from_PL.category, 'category', properties, null, null, function categoryAddedCB(err, new_id) {
            if (err) {
                debug('Entu failed to add category', err)
                callback(err)
                return
            }
            debug('Entu added category ' + new_id, err)
            callback()
        })

    }, function(err) {
        if (err) {
            debug('Each failed for add missing categories')
            callback(err)
            return
        }
        // debug('Missing categories added.')
        callback()
    })
})
// Add missing performances to Entu
cache_series.push(function addPerformances2Entu(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Add new performances to Entu"')
        callback()
        return
    }
    if (Object.keys(PL_shows).length === 0) {
        callback()
        return
    }
    debug('Add new performances to Entu. (' + Object.keys(PL_shows).length + ')')
    immediate_reload_required = true

    async.each(PL_shows, function(PL_show, callback) {
        // debug(op.get(PL_show, 'category'))
        // debug(op.get(PL_show, 'category').map(function(id) {return temp_local_entities.by_plid[id].id}))
        var properties = {
            "pl-id": parseInt(PL_show.id),
            "category": op.get(PL_show, 'category', []).map(function(id) {return op.get(temp_local_entities, ['by_plid', id, 'id'])})[0],
            "et-name": op.get(PL_show, 'title.est'),
            "en-name": op.get(PL_show, 'title.eng'),
            "et-purchase-description": op.get(PL_show, 'purchaseDescription.est'),
            "en-purchase-description": op.get(PL_show, 'purchaseDescription.eng'),
            "et-description": op.get(PL_show, 'description.est'),
            "en-description": op.get(PL_show, 'description.eng'),
            "photo-url": op.get(PL_show, 'originalImageUrl'),
            "thumb-url": op.get(PL_show, 'shortImageUrl'),
        }
        // debug(JSON.stringify(properties, null, 2))
        entu.add(cache_from_PL.show, 'performance', properties, null, null, function performanceAddedCB(err, new_id) {
            if (err) {
                debug('Entu failed to add performance', err)
                callback(err)
                return
            }
            debug('Entu added performance ' + new_id, err)
            callback()
        })

    }, function(err) {
        if (err) {
            debug('Each failed for add missing performances')
            callback(err)
            return
        }
        // debug('Missing performances added.')
        callback()
    })
})
// Add missing events to Entu
cache_series.push(function add2Entu(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Add new events to Entu"')
        callback()
        return
    }
    if (Object.keys(PL_concerts).length === 0) {
        callback()
        return
    }
    debug('Add new events to Entu. (' + Object.keys(PL_concerts).length + ')')
    immediate_reload_required = true

    async.eachLimit(PL_concerts, 1, function(PL_concert, callback) {
        var start_time = new Date(op.get(PL_concert, 'startTimestamp')*1000)
        var end_time = new Date(op.get(PL_concert, 'endTimestamp')*1000)
        var sales_time = new Date(op.get(PL_concert, 'salesTimestamp')*1000)
        var properties = {
            "pl-id": parseInt(PL_concert.id),
            "performance": op.get(temp_local_entities, ['by_plid', op.get(PL_concert, 'showId'), 'id']),
            "start-time": start_time.toLocaleDateString() + ' ' + start_time.toLocaleTimeString(),
            "end-time": end_time.toLocaleDateString() + ' ' + end_time.toLocaleTimeString(),
            "sales-time": sales_time.toLocaleDateString() + ' ' + sales_time.toLocaleTimeString(),
            "sales-status": op.get(PL_concert, 'salesStatus'),
            "min-price": op.get(PL_concert, 'minPrice'),
            "max-price": op.get(PL_concert, 'maxPrice'),
        }
        // debug(JSON.stringify(properties, null, 2))
        entu.add(cache_from_PL.concert, 'event', properties, null, null, function eventAddedCB(err, new_id) {
            if (err) {
                debug('Entu failed to add event', err)
                callback(err)
                return
            }
            debug('Entu added event ' + new_id, err)
            callback()
        })

    }, function(err) {
        if (err) {
            debug('Each failed for add missing events')
            callback(err)
            return
        }
        // debug('Missing events added.')
        callback()
    })
})

// Save cache
cache_series.push(function saveCache(callback) {
    if (immediate_reload_required) {
        debug('Skipping "Save Cache"')
        callback()
        return
    }
    SDC.set('local_entities', temp_local_entities)
    SDC.set('relationships', temp_relationships)

    var writer_fs = []

    async.each(Object.keys(SDC.get()), function(filename, callback) {
        debug('Saving ' + filename)
        var entities_ws = fs.createWriteStream(path.join(APP_CACHE_DIR, filename + '.json'))
        entities_ws.write(JSON.stringify(SDC.get(filename), null, 4), callback)
    }, function(err) {
        if (err) {
            debug('Saving cache failed', err)
            callback(err)
            return
        }
        debug('cache saved')
        callback()
    })
})


// Final cleanup
cache_series.push(function cleanup(callback) {
    temp_local_entities = {}
    temp_relationships = {}
    PL_categories = {}
    PL_shows = {}
    PL_concerts = {}
    callback()
})


var add2cache = function add2cache(entity, e_class) {
    op.set(temp_local_entities, ['by_eid', String(entity.id)], entity)
    if (e_class) {
        op.set(temp_local_entities, ['by_class', e_class, String(entity.id)], entity)
    }
    op.set(temp_local_entities, ['by_definition', entity.definition, String(entity.id)], entity)
    if (pl_id = op.get(entity, 'properties.pl-id.value', false)) {
        op.set(temp_local_entities, ['by_plid', String(pl_id)], entity)
    }

    if (op.get(entity, ['properties', 'featured', 'value']) === "True") {
        if (op.get(entity, ['definition']) === "performance") {
            op.set(temp_local_entities, ['featured', String(entity.id)], entity)
        }
    }
    return
}

var relate = function relate(eid1, rel1, eid2, rel2) {
    if (op.get(temp_relationships, [String(eid1), rel1], []).indexOf(String(eid2)) === -1) {
        op.push(temp_relationships, [String(eid1), rel1], String(eid2))
    }
    if (rel2) {
        if (op.get(temp_relationships, [String(eid2), rel2], []).indexOf(String(eid1)) === -1) {
            op.push(temp_relationships, [String(eid2), rel2], String(eid1))
        }
    }
}
var cacheCategory = function cacheCategory(e_class, op_entity, callback) {
    if (pl_id = op_entity.get('properties.pl-id.value', false)) {
        op.del(PL_categories, pl_id)
    }
    callback()
}
var cachePerformance = function cachePerformance(e_class, op_entity, callback) {
    if (pl_id = op_entity.get('properties.pl-id.value', false)) {
        op.del(PL_shows, pl_id)
    }
    if (perf_ref = op_entity.get('properties.premiere.reference', false)) {
        relate(op_entity.get('id'), 'premiere', perf_ref, 'performance')
    }
    var parent_eid = op_entity.get('id')
    entu.get_childs(parent_eid, null, null, null, function(err, entities) {
        if (err) {
            // debug('Fetch childs: ' + definition + '@' + parent_eid + ' from Entu failed.', err)
            callback(err)
            return
        }
        async.each(entities, function(op_entity, callback) {
            var entity = op_entity.get()
            relate(entity.id, 'parent', parent_eid, entity.definition)
            add2cache(entity)
            callback()
        }, function(err) {
            if (err) {
                debug('Each failed for childs of ' + parent_eid)
                callback(err)
                return
            }
            // debug('Each succeeded for childs of ' + parent_eid)
            callback()
        })
    })
}
var cacheEvent = function cacheEvent(op_entity, callback) {
    if (pl_id = op_entity.get('properties.pl-id.value', false)) {
        // TODO: Merge ticket information from PL_concert ...
        //       sales-time
        //       sales-status
        //       min-price
        //       max-price
        // ... and remove from PL
        op.del(PL_concerts, pl_id)
    }
    if (perf_ref = op_entity.get('properties.performance.reference', false)) {
        relate(op_entity.get('id'), 'performance', op_entity.get('properties.performance.reference'), 'event')
    }
    var parent_eid = op_entity.get('id')
    entu.get_childs(parent_eid, null, null, null, function(err, entities) {
        if (err) {
            // debug('Fetch childs: ' + definition + '@' + parent_eid + ' from Entu failed.', err)
            callback(err)
            return
        }
        // if (!e_class) {
        //     e_class = op.get(festivals, String(parent_eid))
        // }
        async.each(entities, function(op_entity, callback) {
            var entity = op_entity.get()
            relate(entity.id, 'parent', parent_eid, entity.definition)

            add2cache(entity)
            if (op_entity.get('definition') === 'event') {
                cacheEvent(op_entity, callback)
            } else {
                callback()
            }
        }, function(err) {
            if (err) {
                debug('Each failed for childs of ' + parent_eid)
                callback(err)
                return
            }
            // debug('Each succeeded for childs of ' + parent_eid)
            callback()
        })
    })
}
var cacheNews = function cacheNews(e_class, op_entity, callback) {
    callback()
}
var cachePerson = function cachePerson(e_class, op_entity, callback) {
    callback()
}
var cacheLocation = function cacheLocation(e_class, op_entity, callback) {
    callback()
}
var cacheBanner = function cacheLocation(e_class, op_entity, callback) {
    callback()
}
var cacheCoverage = function cacheCoverage(e_class, op_entity, callback) {
    callback()
}


var routine = function routine(WorkerReloadCB) {
    console.log('Cache routine started')
    async.series(cache_series, function routineFinally(err) {
        if (err) {
            debug('Routine stumbled. Restart in 125', err)
            setTimeout(function() {
                routine(WorkerReloadCB)
            }, 125*1000)
            setTimeout(function(){debug('1')}, 124*1000)
            setTimeout(function(){debug('2')}, 123*1000)
            setTimeout(function(){debug('3')}, 122*1000)
            setTimeout(function(){debug('4')}, 121*1000)
            return
        }
        if (immediate_reload_required) {
            immediate_reload_required = false
            debug('Immediate reload requested - restarting in 3')
            setTimeout(function() {
                routine(WorkerReloadCB)
            }, 3*1000)
            setTimeout(function(){debug('1')}, 2*1000)
            setTimeout(function(){debug('2')}, 1*1000)
        } else {
            debug('Restarting routine in ' + CACHE_REFRESH_MS/1000 + ' sec.')
            setTimeout(function() {
                routine(WorkerReloadCB)
            }, CACHE_REFRESH_MS)
            setTimeout(function(){debug('1')}, CACHE_REFRESH_MS - 1*1000)
            setTimeout(function(){debug('2')}, CACHE_REFRESH_MS - 2*1000)
            setTimeout(function(){debug('3')}, CACHE_REFRESH_MS - 3*1000)
            setTimeout(function(){debug('4')}, CACHE_REFRESH_MS - 4*1000)
            setTimeout(function(){debug('Restarting routine in 5')}, CACHE_REFRESH_MS - 5*1000)
            WorkerReloadCB()
        }
    })
}
module.exports.routine = routine
