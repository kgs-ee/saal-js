var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')
var async   = require('async')
var op      = require('object-path')
var fs      = require('fs')

var entu    = require('../helpers/entu')

debug('Maintenance Started at ' + Date().toString())

fs.readdir('./pagecache', function(error, files) {
    if (error) {
        debug('0', error)
    }
    files.forEach(function(file) {
        debug('Read from cache: ' + path.basename(file, '.json'))
        if (path.extname(file) === '.json') {
            SDC.set(path.basename(file, '.json'), require(path.join('../pagecache', file)))
        }
    })
})

var cacheEntities = function cacheEntities(name, definition, parent, reset_markers, delay_ms, marker_f, manipulator_f) {
    debug('Caching ' + name)
    var callback = function(error, entities) {
        if (error) {
            if (error.code == 'ENOTFOUND') {
                debug('Retry in 5 sec', error)
                setTimeout(function() {cacheEntities(name, definition, parent, reset_markers, delay_ms, marker_f, manipulator_f)}, 5*1000)
                return
            }
        }
        var marked_entities_1 = {}
        var marked_entities_2 = {}
        async.each(entities, function(one_entity, callback) {
            var markers = []
            manipulator_f(one_entity, function(error, processed_entity) {
                if (error) {
                    debug('4', error)
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
                    // op.push(marked_entities, marker, one_entity.get())
                })
                callback()
            })
        }, function (error) {
            if (error) {
                debug('2', error)
            }
            Object.keys(marked_entities_1).sort().forEach(function(marker) {
                // debug('pushing to ' + marker, JSON.stringify(marked_entities_1[marker], null, '  '))
                op.set(marked_entities_2, marker, marked_entities_1[marker])
            })

            for (marker in marked_entities_2) {
                debug('Writing ' + name + '.' + marker + ' to cache.')
                var ws = fs.createWriteStream('./pagecache/' + name + '_' + marker + '.json')
                ws.write(JSON.stringify(marked_entities_2[marker], null, '  '))
                SDC.set(name + '_' + marker, marked_entities_2[marker])
            }
            if (delay_ms) {
                setTimeout(function() {cacheEntities(name, definition, parent, reset_markers, delay_ms, marker_f, manipulator_f)}, delay_ms)
            }
            debug('Caching ' + name + ' done. Next check in ' + delay_ms/1000 + ' sec.')
        })
    }
    if (parent) {
        entu.get_childs(parent=parent, definition=definition, auth_id=null, auth_token=null, callback=callback)
    } else {
        entu.get_entities(definition=definition, limit=null, auth_id=null, auth_token=null, callback=callback)
    }
}


var event_manipulator = function manipulator_f(entity_in, callback) {
    var entity_out = op({})
    entity_out.set('id', entity_in.get('id'))
    entity_out.set('category', entity_in.get('properties.category'))
    entity_out.set('name', entity_in.get('properties.name.value'))
    entity_out.set('description', entity_in.get('properties.description.md'))
    entity_out.set('photo', entity_in.get('properties.photo.0'))
    entity_out.set('photos', entity_in.get('properties.photo'))
    entity_out.set('video', entity_in.get('properties.video.value'))
    entity_out.set('location', entity_in.get('properties.location.value'))
    entity_out.set('price', entity_in.get('properties.price.value'))
    entity_out.set('ticket-api', entity_in.get('properties.ticket-api.value'))
    entity_out.set('technical-information', entity_in.get('properties.technical-information.md'))

    entity_in.get('properties.start-time', []).forEach(function(starttime) {
        entity_out.push('start-times', starttime.value)
    })

    if (entity_in.get('properties.performance.reference')) {
        // debug('fetch performance')
        entu.get_entity(id=entity_in.get('properties.performance.reference'), null, null, performanceCB=function(error, performance) {
            if (error) {
                debug('Event manipulator performance reference', error)
            }
            entity_out.set('performance', performance_manipulator(performance).get())
            // debug(entity_out.get('performance'))
            callback(null, entity_out)
        })
    } else {
        // debug('no performance')
        callback(null, entity_out)
    }
}


var performance_manipulator = function manipulator_f(entity_in) {
    var entity_out = op({})
    entity_out.set('id', entity_in.get('id'))
    entity_out.set('category', entity_in.get('properties.category'))
    entity_out.set('name', entity_in.get('properties.name.value'))
    entity_out.set('description', entity_in.get('properties.description.md'))
    entity_out.set('photo', entity_in.get('properties.photo.0'))
    entity_out.set('photos', entity_in.get('properties.photo'))
    entity_out.set('video', entity_in.get('properties.video.value'))
    entity_out.set('technical-information', entity_in.get('properties.technical-information.md'))
    return entity_out
}


// Split events into past and future and group by time
cacheEntities(
    name = 'program',
    definition = 'event',
    parent = 597,
    reset_markers = ['no_date', 'past', 'upcoming'],
    delay_ms = 15 * 60 * 1000,
    marker_f = function marker_f(entity) {
        var event_times = entity.get('start-times')
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
    manipulator_f = event_manipulator
)

// Fetch events from under SAAL Biennaal and group by time
cacheEntities(
    name = 'SAAL_Biennaal',
    definition = 'event',
    parent = 1932,
    reset_markers = ['no_date', 'past', 'upcoming'],
    delay_ms = 30 * 60 * 1000,
    marker_f = function marker_f(entity) {
        var event_times = entity.get('start-times')
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
    manipulator_f = event_manipulator
)


// Fetch events from under NU Performance and group by time
cacheEntities(
    name = 'NU_Performance',
    definition = 'event',
    parent = 1933,
    reset_markers = ['no_date', 'past', 'upcoming'],
    delay_ms = 30 * 60 * 1000,
    marker_f = function marker_f(entity) {
        var event_times = entity.get('start-times')
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
    manipulator_f = event_manipulator
)


// Fetch events from under Tours and group by time
cacheEntities(
    name = 'Tours',
    definition = 'event',
    parent = 1929,
    reset_markers = ['no_date', 'past', 'upcoming'],
    delay_ms = 30 * 60 * 1000,
    marker_f = function marker_f(entity) {
        var event_times = entity.get('start-times')
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
    manipulator_f = event_manipulator
)


// Fetch events from under Residency and group by time
cacheEntities(
    name = 'Residency',
    definition = 'event',
    parent = 1931,
    reset_markers = ['no_date', 'past', 'upcoming'],
    delay_ms = 30 * 60 * 1000,
    marker_f = function marker_f(entity) {
        var event_times = entity.get('start-times')
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
    manipulator_f = event_manipulator
)


// Split news into old and new and group by time
cacheEntities(
    name = 'news',
    definition = 'news',
    parent = 597,
    reset_markers = ['no_date', 'past', 'upcoming'],
    delay_ms = 10 * 60 * 1000,
    marker_f = function marker_f(entity) {
        var news_time = entity.get(['properties','time','value'])
        var markers = []
        var ms = Date.parse(news_time)
        var news_date = news_time.slice(0,10)
        // var news_date = (new Date(ms)).toJSON().slice(0,10)
        if (ms < Date.now()) {
            markers.push('past.' + news_date)
        } else if (ms >= Date.now()) {
            markers.push('upcoming.' + news_date)
        }
        return markers
    },
    manipulator_f = function manipulator_f(entity) {
        return entity
    }
)


// Example markers on person
cacheEntities(
    name = 'users',
    definition = 'person',
    parent = null,
    reset_markers = ['entusiastid', 'others'],
    delay_ms = 60 * 60 * 1000,
    marker_f = function marker_f(entity) {
        if (entity.get('name') == 'Mihkel-Mikelis Putrinš')
            return ['entusiastid.mihkel']
        else if (entity.get('name') == 'Argo Roots')
            return ['entusiastid.argo']
        else
            return ['others']
    },
    manipulator_f = function manipulator_f(entity_in) {
        var entity_out = op({})
        entity_out.set('id', entity_in.get('id'))
        entity_out.set('name', entity_in.get('displayname'))
        entity_out.set('entity', entity_in.get())
        return entity_out
    }
)