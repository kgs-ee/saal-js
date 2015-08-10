var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')
var async   = require('async')
var op      = require('object-path')
var fs      = require('fs')

var entu    = require('./routes/entu')

debug('Maintenance Started at ' + Date().toString())


var cacheEntities = function cacheEntities(definition, marker_f, delay_ms) {
    debug('Caching ' + definition)
    entu.get_entities(definition, null, null, function(error, events) {
        if (error) {
            debug('1', error)
        }
        var marked_entities = {}
        async.each(events, function(one_entity, callback) {
            marker_f(one_entity).forEach(function(marker) {
                op.push(marked_entities, marker, one_entity.get())
            })
            callback()
        }, function (error) {
            if (error) {
                debug('2', error)
            }
            for (c in marked_entities) {
                var ws = fs.createWriteStream('./pagecache/' + definition + '_' + c + '.json')
                // var sorted = marked_entities[c].sort(sort_f)
                ws.write(JSON.stringify(marked_entities[c], null, '  '))
            }
            if (delay_ms) {
                setTimeout(function() {cacheEntities(definition, marker_f, delay_ms)}, delay_ms)
            }
            debug('Caching ' + definition + ' done.')
        })
    })
}


// Example markers on person
cacheEntities(
    'person',
    function marker_f(entity) {
        var forename = entity.get('properties.forename.value')
        var is_mihkel = (forename == 'Mihkel-Mikelis')
        var is_argo = (forename == 'Argo')

        if (is_mihkel)
            return ['entusiastid.mihkel']
        else if (is_argo)
            return ['entusiastid.argo']
        else
            return ['others']
    },
    60 * 1000)


// Split events into past and future and group by time
cacheEntities(
    'event',
    function marker_f(entity) {
        var event_times = entity.get('properties.time')
        var markers = []
        for (t in event_times) {
            var ms = Date.parse(entity.get(['properties','time',t,'value']))
            var event_date = (new Date(ms)).toJSON().slice(0,10)
            if (ms < Date.now()) {
                markers.push('past.' + event_date)
            } else if (ms >= Date.now()) {
                markers.push('upcoming.' + event_date)
            }
        }
        return markers
    },
    60 * 60 * 1000
)


// Split news into old and new and group by time
cacheEntities(
    'news',
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
    30 * 1000
)
