var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')
var async   = require('async')
var op      = require('object-path')
var fs      = require('fs')

var entu    = require('../helpers/entu')


debug('Maintenance Started at ' + Date().toString())

// populate cache
fs.readdir(APP_CACHE_DIR, function(error, files) {
    if (error) {
        debug('0', error)
    }
    files.forEach(function(file) {
        debug('Read from cache: ' + path.basename(file, '.json'))

        var readCacheFile = function readCacheFile() {
            try {
                SDC.set(path.basename(file, '.json'), require(path.join(APP_CACHE_DIR, file)))
            } catch(err) {
                setTimeout(readCacheFile, 100);
            }
        }
        readCacheFile()
    })
})


// var cacheRoot = function cacheRoot() {
//     debug('Caching root')
//     SDC.set(['__', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
//     entu.get_entity(id=APP_ENTU_ROOT, null, null, CB=function(error, institution) {
//         if (error) {
//             debug('Cant cache institution entity', error)
//             setTimeout(cacheRoot, APP_ROOT_REFRESH_MS)
//             return
//         }
//         SDC.set(['__', 'main_color'], institution.get(['properties', 'main-color', 'value']))
//         SDC.set(['__', 'secondary_color'], institution.get(['properties', 'secondary-color', 'value']))
//         // SDC.set(['__', 'calendar_json'], require(path.join(APP_CACHE_DIR, 'calendar_json.json')))
//         fs.createWriteStream(path.join(APP_CACHE_DIR, 'root.json')).write(JSON.stringify(SDC.get('__'), null, '  '))
//         debug('Root cached')
//         setTimeout(cacheRoot, APP_ROOT_REFRESH_MS)
//     })
// }
// cacheRoot()


// var syncFromPL = function syncFromPL() {
//     debug('Caching root')
//     SDC.set(['__', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
//     entu.get_entity(id=APP_ENTU_ROOT, null, null, CB=function(error, institution) {
//         if (error) {
//             debug('Cant cache institution entity', error)
//             setTimeout(syncFromPL, APP_ROOT_REFRESH_MS)
//             return
//         }
//         SDC.set(['__', 'main_color'], institution.get(['properties', 'main-color', 'value']))
//         SDC.set(['__', 'secondary_color'], institution.get(['properties', 'secondary-color', 'value']))
//         // SDC.set(['__', 'calendar_json'], require(path.join(APP_CACHE_DIR, 'calendar_json.json')))
//         fs.createWriteStream(path.join(APP_CACHE_DIR, 'root.json')).write(JSON.stringify(SDC.get('__'), null, '  '))
//         debug('Root cached')
//         setTimeout(syncFromPL, APP_ROOT_REFRESH_MS)
//     })
// }
// syncFromPL()
var CB_id = 0

var cacheEntities = function cacheEntities(
    name,
    definition,
    parent,
    reset_markers,
    marker_f,
    manipulator_f,
    finally_f,
    callback
) {
    debug('Caching ' + name)
    CB_id ++
    var entuCB = function(err, entities) {
        if (err) {
            debug('entuCB[' + CB_id + '] for ' + name + ' stumbled', err)
            callback(err)
            return
        }
        if (entities === undefined) {
            callback(new Error('entuCB[' + CB_id + '] for ' + name + ' called without entities'))
            return
        }
        debug( 'entuCB[' + CB_id + '] for ' + name + '; parent:' + parent + '; definition:' + definition)
        var marked_entities_1 = {}
        var marked_entities_2 = {}
        async.each(entities, function(one_entity, eachCB) {
            var markers = []
            manipulator_f(one_entity, function(err, processed_entity) {
                if (err) {
                    debug('4', err)
                }
                one_entity = processed_entity
                markers = marker_f(one_entity)
                if (markers.length == 0) {
                    markers.push('_')
                }
                markers.forEach(function(marker) {
                    if (!marked_entities_1[marker]) {
                        marked_entities_1[marker] = []
                    }
                    marked_entities_1[marker].push(one_entity.get())
                })
                finally_f(one_entity)
                eachCB()
            })
        }, function afterEachEntity(err) {
            if (err) {
                debug('entuCB stumbled on each entities', err)
                callback(err)
                return
            }
            Object.keys(marked_entities_1).sort().forEach(function(marker) {
                op.set(marked_entities_2, marker, marked_entities_1[marker])
            })

            for (marker in marked_entities_2) {
                debug('Writing ' + name + '.' + marker + ' to cache.')
                var ws = fs.createWriteStream(path.join(APP_CACHE_DIR, name + '_' + marker + '.json'))
                ws.write(JSON.stringify(marked_entities_2[marker], null, '  '))
                SDC.set(name + '_' + marker, marked_entities_2[marker])
            }
            fs.createWriteStream(path.join(APP_CACHE_DIR, 'all_events.json')).write(JSON.stringify(ALL_EVENTS, null, '    '))
            debug('Caching ' + name + ' done.')
            callback()
        })
    }
    if (parent) {
        entu.get_childs(parent, definition, null, null, entuCB)
    } else {
        entu.get_entities(definition, null, null, null, entuCB)
    }
}


var event_manipulator = function event_manipulator_f(entity_in, callback) {
    var entity_out = op({})
    var event_id = entity_in.get('id')
    entity_out.set('id', event_id)
    entity_out.set('category', entity_in.get('properties.category'))
    entity_out.set('color', entity_in.get('properties.color.value', '').split('; '))
    entity_out.set('tag', entity_in.get('properties.tag.value', '').split('; '))
    entity_out.set('en-name', entity_in.get('properties.en-name.value'))
    entity_out.set('et-name', entity_in.get('properties.et-name.value'))
    entity_out.set('en-description', entity_in.get('properties.en-description.md'))
    entity_out.set('et-description', entity_in.get('properties.et-description.md'))
    entity_out.set('photo', entity_in.get('properties.photo.0'))
    entity_out.set('photos', entity_in.get('properties.photo'))
    entity_out.set('video', entity_in.get('properties.video.value'))
    entity_out.set('location', entity_in.get('properties.location.value'))
    entity_out.set('price', entity_in.get('properties.price.value'))
    entity_out.set('ticket-api', entity_in.get('properties.ticket-api.value'))
    entity_out.set('en-technical-information', entity_in.get('properties.en-technical-information.md'))
    entity_out.set('et-technical-information', entity_in.get('properties.et-technical-information.md'))

    entity_out.set('start-time', [])
    entity_in.get('properties.start-time', []).forEach(function stiterator(start_time) {
        entity_out.push('start-time', start_time.value)
    })
    // entity_out.set('start-time', entity_in.get('properties.start-time'))


    var parallelf = []
    parallelf.push(function(callback) {
        // debug('First parallelf for event ' + event_id)
        callback()
    })

    var performance_id = entity_in.get('properties.performance.reference')
    if (performance_id) {
        parallelf.push(function(callback) {
            // debug('fetch performance')
            entu.get_entity(performance_id, null, null, function performanceCB(err, performance) {
                if (err) {
                    debug('Event manipulator performance reference failed for '
                        + event_id + '->' + performance_id, err)
                } else {
                    entity_out.set('performance', performance_manipulator(performance).get())
                }
                // debug(entity_out.get('performance'))
                callback()
            })
        })
        parallelf.push(function(callback) {
            entu.get_childs(performance_id, 'coverage', null, null, function(err, entities) {
                if (err) {
                    // debug('GetEventCoverage err for performance ' + performance_id, err)
                    callback()
                    return
                }
                // debug('GetEventCoverage for performance ' + performance_id + ', coverages: ' + entities.length)
                entity_out.set('performance.coverage', [])
                async.each(
                    entities,
                    function iterateEntities(coverage, iteratorCB) {
                        // debug('performance ' + performance_id + ', coverage', coverage.get('id'))
                        entity_out.push('performance.coverage', coverage_manipulator(coverage).get())
                        iteratorCB()
                    },
                    function finallyEntities() {
                        // debug('finallyEntities')
                        callback()
                    }
                )
            })
        })
    }

    parallelf.push(function(callback) {
        entu.get_childs(event_id, 'coverage', null, null, function(err, entities) {
            if (err) {
                // debug('GetEventCoverage err for event ' + event_id, err)
                callback()
                return
            }
            // debug('GetEventCoverage for event ' + event_id + ', coverages: ' + entities.length)
            entity_out.set('coverage', [])
            async.each(
                entities,
                function iterateEntities(coverage, iteratorCB) {
                    // debug('event ' + event_id + ', coverage', coverage.get('id'))
                    entity_out.push('coverage', coverage_manipulator(coverage).get())
                    iteratorCB()
                },
                function finallyEntities() {
                    // debug('finallyEntities')
                    callback()
                }
            )
        })
    })

    parallelf.push(function(callback) {
        // debug('Last parallelf for event ' + event_id)
        callback()
    })

    async.parallel(
        parallelf,
        function() {
            // debug('ENDOF PARALLELF')
            callback(null, entity_out)
        }
    )
}

var performance_manipulator = function performance_manipulator_f(entity_in) {
    var entity_out = op({})
    entity_out.set('id', entity_in.get('id'))
    entity_out.set('category', entity_in.get('properties.category'))
    entity_out.set('en-name', entity_in.get('properties.en_name.value'))
    entity_out.set('et-name', entity_in.get('properties.et_name.value'))
    entity_out.set('en-subtitle', entity_in.get('properties.en_subtitle.value'))
    entity_out.set('et-subtitle', entity_in.get('properties.et_subtitle.value'))
    entity_out.set('en-description', entity_in.get('properties.en-description.md'))
    entity_out.set('et-description', entity_in.get('properties.et-description.md'))
    entity_out.set('photo', entity_in.get('properties.photo.0'))
    entity_out.set('photos', entity_in.get('properties.photo'))
    entity_out.set('audio', entity_in.get('properties.audio.value'))
    entity_out.set('video', entity_in.get('properties.video.value'))
    entity_out.set('et-technical-information', entity_in.get('properties.et-technical-information.md'))
    entity_out.set('en-technical-information', entity_in.get('properties.en-technical-information.md'))
    return entity_out
}

var coverage_manipulator = function coverage_manipulator_f(entity_in) {
    var entity_out = op({})
    entity_out.set('id', entity_in.get('id'))
    entity_out.set('title', entity_in.get('properties.title.value'))
    entity_out.set('date', entity_in.get('properties.date.value'))
    entity_out.set('text', entity_in.get('properties.text.md'))
    entity_out.set('url', entity_in.get('properties.url.value'))
    entity_out.set('source', entity_in.get('properties.source.value'))
    return entity_out
}

var event_finally = function event_finally(entity_in) {
    if (EVENT_LOOKUP[entity_in.get('id')]) {
        var eveint_idx = EVENT_LOOKUP[entity_in.get('id')]
        ALL_EVENTS[eveint_idx] = entity_in.get()
    } else {
        EVENT_LOOKUP[entity_in.get('id')] = ALL_EVENTS.push(entity_in.get()) - 1
    }
    // debug(EVENT_LOOKUP)
}

// Sync from Entu object by object and relax in between
var cacheSeries = []

cacheSeries.push(function cacheRoot(callback) {
    debug('Caching root')
    SDC.set(['__', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
    entu.get_entity(id=APP_ENTU_ROOT, null, null, CB=function(err, institution) {
        if (err) {
            debug('Caching root failed', err)
            callback()
            // setTimeout(cacheRoot, APP_ROOT_REFRESH_MS)
            return
        }
        SDC.set(['__', 'main_color'], institution.get(['properties', 'main-color', 'value']))
        SDC.set(['__', 'secondary_color'], institution.get(['properties', 'secondary-color', 'value']))
        // SDC.set(['__', 'calendar_json'], require(path.join(APP_CACHE_DIR, 'calendar_json.json')))
        fs.createWriteStream(path.join(APP_CACHE_DIR, 'root.json')).write(JSON.stringify(SDC.get('__'), null, '  '))
        debug('Root cached')
        callback()
        // setTimeout(cacheRoot, APP_ROOT_REFRESH_MS)
    })
})

// _cacheSeries = []
// Split events into past and future and group by time
cacheSeries.push(function (callback) {
    cacheEntities(
        name = 'program',
        definition = 'event',
        parent = 597, // Kodulehe mängukava
        reset_markers = ['no_date', 'past', 'upcoming'],
        marker_f = function marker_f(entity) {
            var event_times = entity.get('start-time')
            var markers = []
            if (!event_times || !Array.isArray(event_times) || event_times.length == 0) {
                markers.push('no_date')
            } else {
                for (i in event_times) {
                    var ms = Date.parse(event_times[i])
                    var event_date = (event_times[i]).slice(0,10)
                    var event_time = (event_times[i]).slice(11,16)
                    // var event_date = (new Date(ms)).toJSON().slice(0,10)
                    if (ms < Date.now()) {
                        markers.push('past.' + event_date + '.' + event_time)
                    } else if (ms >= Date.now()) {
                        markers.push('upcoming.' + event_date + '.' + event_time)
                    }
                }
            }
            return markers
        },
        manipulator_f = event_manipulator,
        finally_f = event_finally,
        callback
    )
})

// Fetch events from under SAAL Biennaal and group by time
cacheSeries.push(function (callback) {
    cacheEntities(
        name = 'SAAL_Biennaal',
        definition = 'event',
        parent = 1932,
        reset_markers = ['no_date', 'past', 'upcoming'],
        marker_f = function marker_f(entity) {
            var event_times = entity.get('start-time')
            var markers = []
            if (!event_times || !Array.isArray(event_times) || event_times.length == 0) {
                markers.push('no_date')
            } else {
                for (i in event_times.sort()) {
                    var ms = Date.parse(event_times[i])
                    var event_date = (event_times[i]).slice(0,10)
                    var event_time = (event_times[i]).slice(11,16)
                    // var event_date = (new Date(ms)).toJSON().slice(0,10)
                    if (ms < Date.now()) {
                        markers.push('past.' + event_date + '.' + event_time)
                    } else if (ms >= Date.now()) {
                        markers.push('upcoming.' + event_date + '.' + event_time)
                    }
                }
            }
            return markers
        },
        manipulator_f = event_manipulator,
        finally_f = event_finally,
        callback
    )
})

// Fetch events from under NU Performance and group by time
cacheSeries.push(function (callback) {
    cacheEntities(
        name = 'NU_Performance',
        definition = 'event',
        parent = 1933,
        reset_markers = ['no_date', 'past', 'upcoming'],
        marker_f = function marker_f(entity) {
            var event_times = entity.get('start-time')
            var markers = []
            if (!event_times || !Array.isArray(event_times) || event_times.length == 0) {
                markers.push('no_date')
            } else {
                for (i in event_times.sort()) {
                    var ms = Date.parse(event_times[i])
                    var event_date = (event_times[i]).slice(0,10)
                    var event_time = (event_times[i]).slice(11,16)
                    // var event_date = (new Date(ms)).toJSON().slice(0,10)
                    if (ms < Date.now()) {
                        markers.push('past.' + event_date + '.' + event_time)
                    } else if (ms >= Date.now()) {
                        markers.push('upcoming.' + event_date + '.' + event_time)
                    }
                }
            }
            return markers
        },
        manipulator_f = event_manipulator,
        finally_f = event_finally,
        callback
    )
})

// Fetch events from under Tours and group by time
cacheSeries.push(function (callback) {
    cacheEntities(
        name = 'tours',
        definition = 'event',
        parent = 1929, // Tuurid
        reset_markers = ['no_date', 'past', 'upcoming'],
        marker_f = function marker_f(entity) {
            var event_times = entity.get('start-time')
            var markers = []
            if (!event_times || !Array.isArray(event_times) || event_times.length == 0) {
                markers.push('no_date')
            } else {
                for (i in event_times.sort()) {
                    var ms = Date.parse(event_times[i])
                    var event_date = (event_times[i]).slice(0,10)
                    var event_time = (event_times[i]).slice(11,16)
                    // var event_date = (new Date(ms)).toJSON().slice(0,10)
                    if (ms < Date.now()) {
                        markers.push('past.' + event_date + '.' + event_time)
                    } else if (ms >= Date.now()) {
                        markers.push('upcoming.' + event_date + '.' + event_time)
                    }
                }
            }
            return markers
        },
        manipulator_f = event_manipulator,
        finally_f = event_finally,
        callback
    )
})

// Fetch events from under Residency and group by time
cacheSeries.push(function (callback) {
    cacheEntities(
        'residency',  // name
        'event',  // definition
        1931,  // parent = Residentuur
        ['no_date', 'past', 'upcoming'],  // reset_markers
        function marker_f(entity) {  // marker_f
            var event_times = entity.get('start-time')
            var markers = []
            if (!event_times || !Array.isArray(event_times) || event_times.length == 0) {
                markers.push('no_date')
            } else {
                for (i in event_times.sort()) {
                    var ms = Date.parse(event_times[i])
                    var event_date = (event_times[i]).slice(0,10)
                    var event_time = (event_times[i]).slice(11,16)
                    if (ms < Date.now()) {
                        markers.push('past.' + event_date + '.' + event_time)
                    } else if (ms >= Date.now()) {
                        markers.push('upcoming.' + event_date + '.' + event_time)
                    }
                }
            }
            return markers
        },
        manipulator_f = event_manipulator,
        finally_f = event_finally,
        callback
    )
})

// Split news into old and new and group by time
cacheSeries.push(function (callback) {
    cacheEntities(
        name = 'news',
        definition = 'news',
        parent = 1953, // Uudised
        reset_markers = ['no_date', 'past', 'upcoming'],
        marker_f = function marker_f(entity) {
            var news_time = entity.get(['properties','time','value'])
            var markers = []
            if (!news_time) {
                markers.push('no_date')
                return markers
            }
            var ms = Date.parse(news_time)
            var news_date = news_time.slice(0,10)
            if (ms < Date.now()) {
                markers.push('past.' + news_date)
            } else if (ms >= Date.now()) {
                markers.push('upcoming.' + news_date)
            }
            return markers
        },
        manipulator_f = function manipulator_f(entity_in, callback) {
            callback(null, entity_in)
        },
        function newsFinally(entity_in) {
            // debug('newsFinally: ' + entity_in.get('id'))
        },
        callback
    )
})


cacheSeries.push(function popCalendar(callback) {
    var event_calendar = {}
    async.each(ALL_EVENTS, function(one_event, callback) {
        if(one_event['start-time']) {
            one_event['start-time'].forEach(function(startdatetime) {
                var starttime = '00:00'
                if (startdatetime.length == 16) {
                    starttime = startdatetime.slice(11,16)
                }
                one_event.time = starttime
                op.push(event_calendar, startdatetime.slice(0,10), one_event)
            })
        }
        callback()
    }, function(err) {
        if (err) {
            debug('popCalendar failed', err)
            callback(err)
            return
        }
        fs.createWriteStream(path.join(APP_CACHE_DIR, 'calendar.json')).write(JSON.stringify(event_calendar, null, '    '))
        callback()
    })
})


// Example markers on person
cacheSeries.push(function (callback) {
    cacheEntities(
        'users',  // name
        'person',  // definition
        null,  // parent
        ['entusiastid', 'others'],  // reset_markers
        function marker_f(entity) {  // marker_f
            if (entity.get('name') == 'Mihkel-Mikelis Putrinš')
                return ['entusiastid.mihkel']
            else if (entity.get('name') == 'Argo Roots')
                return ['entusiastid.argo']
            else
                return ['others']
        },
        manipulator_f = function manipulator_f(entity_in, callback) {
            var entity_out = op({})
            entity_out.set('id', entity_in.get('id'))
            entity_out.set('name', entity_in.get('displayname'))
            entity_out.set('phone', entity_in.get('properties.phone.value'))
            entity_out.set('email', entity_in.get('properties.email.value'))
            entity_out.set('entity', entity_in.get())
            callback(null, entity_out)
            // return entity_out
        },
        function personFinally(entity_in) {
            // debug('personFinally: ' + entity_in.get('id'))
        },
        callback
    )
})


var routine = function routine() {
    async.series(cacheSeries, function routineFinally(err) {
        if (err) {
            debug('Routine stumbled', err)
            setTimeout(routine, 5*1000)
            return
        }
        debug('restarting routine in ' + APP_ROOT_REFRESH_MS/1000 + ' sec.')
        setTimeout(routine, APP_ROOT_REFRESH_MS)
    })
}
routine()


