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
        SDC.set(path.basename(file, '.json'), require(path.join('../pagecache', file)))
    })
})

var cacheEntities = function cacheEntities(definition, delay_ms, marker_f, manipulator_f) {
    debug('Caching ' + definition)
    entu.get_entities(definition=definition, limit=null, auth_id=null, auth_token=null, callback=function(error, events) {
        if (error) {
            // debug('1', error)
            if (error.code == 'ENOTFOUND') {
                debug('Retry in 5 sec', error)
                setTimeout(function() {cacheEntities(definition, delay_ms, marker_f, manipulator_f)}, 5*1000)
                return
            }
        }
        var marked_entities = {}
        async.each(events, function(one_entity, callback) {
            if (manipulator_f) {
                // debug(one_entity.get())
                one_entity = manipulator_f(one_entity)
                // debug(one_entity.get())
            }
            var markers = marker_f(one_entity)
            if (markers == []) {
                markers.push('_')
            }
            markers.forEach(function(marker) {
                op.push(marked_entities, marker, one_entity.get())
            })
            callback()
        }, function (error) {
            if (error) {
                debug('2', error)
            }
            for (c in marked_entities) {
                debug('Writing ' + definition + '.' + c + ' to cache.')
                var ws = fs.createWriteStream('./pagecache/' + definition + '_' + c + '.json')
                // var sorted = marked_entities[c].sort(sort_f)
                ws.write(JSON.stringify(marked_entities[c], null, '  '))
                SDC.set(definition + '_' + c, marked_entities[c])
            }
            if (delay_ms) {
                setTimeout(function() {cacheEntities(definition, delay_ms, marker_f, manipulator_f)}, delay_ms)
            }
            debug('Caching ' + definition + ' done.')
        })
    })
}


// Example markers on person
cacheEntities(
    'person',
    60 * 60 * 1000,
    function marker_f(entity) {
        if (entity.get('name') == 'Mihkel-Mikelis Putrinš')
            return ['entusiastid.mihkel']
        else if (entity.get('name') == 'Argo Roots')
            return ['entusiastid.argo']
        else
            return ['others']
    },
    function manipulator_f(entity_in) {
        var entity_out = op({})
        entity_out.set('id', entity_in.get('id'))
        entity_out.set('name', entity_in.get('displayname'))
        entity_out.set('entity', entity_in.get())
        return entity_out
    }
)


// Split events into past and future and group by time
cacheEntities(
    'event',
    60 * 60 * 1000,
    function marker_f(entity) {
        var event_times = entity.get('times')
        // debug(event_times)
        var markers = []
        for (i in event_times) {
            var ms = Date.parse(event_times[i])
            var event_date = (new Date(ms)).toJSON().slice(0,10)
            // debug(event_times[i], ms, event_date)
            if (ms < Date.now()) {
                markers.push('past.' + event_date)
            } else if (ms >= Date.now()) {
                markers.push('upcoming.' + event_date)
            }
        }
        return markers
    },
    function manipulator_f(entity_in) {
        var entity_out = op({})
        // debug(entity_in.get())
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

        entity_in.get('properties.time', []).forEach(function(time) {
            entity_out.push('times', time.value)
        })
        // debug(entity_out.get())
        return entity_out
    }
)


// Split news into old and new and group by time
cacheEntities(
    'news',
    30 * 1000,
    function marker_f(entity) {
        var event_times = entity.get('properties.time')
        var markers = []
        var ms = Date.parse(entity.get(['properties','time','value']))
        var news_date = (new Date(ms)).toJSON().slice(0,10)
        if (ms < Date.now()) {
            markers.push('past.' + news_date)
        } else if (ms >= Date.now()) {
            markers.push('upcoming.' + news_date)
        }
        return markers
    },
    function manipulator_f(entity) {
        return entity
    }
)
