var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')
var async   = require('async')
var op      = require('object-path')
var fs      = require('fs')

var entu    = require('./routes/entu')
var checked_this_run = {}

debug('Maintenance Started at ' + Date().toString())

var saveJade = function saveJade(entity) {
    // debug(entity.get('properties.jade'))
    if(entity.get('properties.jade.value')) {
        fs.createWriteStream('./views/e_' + entity.get('id') + '.jade').write(entity.get('properties.jade.value'))
        checked_this_run[entity.get('id')] = Date().toString()
    } else {
        fs.unlink('./views/e_' + entity.get('id') + '.jade', function error(error) {
            // debug(error)
        })
        checked_this_run[entity.get('id')] = 'N/A'
    }
}

var saveJson = function saveJson(entity_o, childs_o) {
    // debug('entity_o', JSON.stringify(entity_o.get(), null, '  '))
    var entity = entity_o.get()
    // debug('entity', JSON.stringify(entity, null, '  '))
    entity.child_ids = []
    async.each(
        childs_o,
        function doLoop(child, callback) {
            // debug(JSON.stringify(child.get(), null, '  '))
            entity.child_ids.push(JSON.stringify(child.get('id'), null, '  '))
            callback()
        },
        function endLoop(error) {
            if(error) {
                debug(error)
            }
            // debug('entity', JSON.stringify(entity, null, '  '))
            fs.createWriteStream('./pagecache/' + entity.id + '.json').write(JSON.stringify(entity, null, '  '))
        }
    )
}

var fetchRoot = function fetchRoot() {
    debug('Run autojade for e_' + WWW_ROOT_EID + ' at ' + Date().toString(), checked_this_run)
    entu.get_entity(WWW_ROOT_EID, null, null, function(error, page_entity) {
        // debug('entity_o', JSON.stringify(page_entity.get(), null, '  '))
        if(error) {
            debug('get_entity', error)
            setTimeout(fetchRoot, 10000)
            return
        }

        saveJade(page_entity)
        fetchChilds(page_entity, function runIsOver(error, childs) {
            if(error) {
                debug('fetch_childs', error)
                setTimeout(fetchRoot, 10000)
                return
            }
            checked_this_run = {}
            saveJson(page_entity, childs)
            debug('Run finished at ' + Date().toString())
            setTimeout(fetchRoot, 5 * 60 * 1000)
        })
    })
}

var fetchChilds = function fetchChilds(entity, childsCB) {
    var eid = entity.get('id')
    entu.get_childs(eid, null, null, null, function(error, childs) {
        if(error) {
            debug(error)
        }

        saveJson(entity, childs)

        async.forEachOfSeries(childs, function (child_entity, key, callback) {
            var ch_eid = child_entity.get('id')
            // debug(key, child_entity.get(), ch_eid)

            if(checked_this_run[ch_eid]) {
                return callback(null)
            }
            saveJade(child_entity)
            // checked_this_run[ch_eid] = Date().toString()
            fetchChilds(child_entity, callback)
        }, function (error) {
            if(error) {
                debug(error)
            }
            childsCB(null, childs)
        })
    })
}

// fetchRoot()

var readEvents = function readEvents() {
    entu.get_entities('person', null, null, function(error, events) {
        if(error) {
            debug(error)
        }
        var past_events = []
        var upcoming_events = []
        async.each(events, function(one_event, callback) {
            past_events.push(one_event.get())
            debug(one_event.get('forename.value'))
            callback()
        }, function (error) {
            if(error) {
                debug(error)
            }
            // debug(past_events)
            fs.createWriteStream('./pagecache/events' + '.json').write(JSON.stringify(past_events, null, '  '))
        })
    })
}

readEvents()