var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

router.get('/:festival_id', function(req, res, next) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    var festival = op.get(festivals, req.params.festival_id)
    res.render('festival', {
        "festival": festival
    })
    res.end()
})

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareFestivals)
    async.parallel(parallelf, function(err) {
        if (err) {
            debug('Failed to prepare ' + path.basename(__filename).replace('.js', ''), err)
            callback(err)
            return
        }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

var festivals = {}

var prepareFestivals = function prepareFestivals(callback) {
    festivals = {}
    async.each(SDC.get(['local_entities', 'by_class', 'festival']), function(festival_entity, callback) {
        op.set(festivals, festival_entity.id, mapper.event(festival_entity.id))
        // debug(JSON.stringify(event, null, 2))
        async.each(SDC.get(['relationships', festival_entity.id, 'event']), function(eid, callback) {
            var event = mapper.event(eid)
            // debug(JSON.stringify(event, null, 2))
            if(event['start-time']) {
                var event_date = (event['start-time']).slice(0,10)
                var event_time = (event['start-time']).slice(11,16)
                op.push(festivals, [festival_entity.id, 'events', event_date, event_time], event)
            }
            callback()
        }, function(err) {
            if (err) {
                debug('Failed to prepare festival ' + festival_entity.id, err)
                callback(err)
                return
            }
            // debug('Festival ' + festival_entity.id + ' prepared.')
            callback()
        })
    }, function(err) {
        if (err) {
            debug('Failed to prepare festivals.', err)
            callback(err)
            return
        }
        // debug('Festivals prepared.' + JSON.stringify(festivals, null, 4))
        callback()
    })
}
module.exports = router
