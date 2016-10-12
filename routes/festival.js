var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var festivals = {}

router.get('/:festival_id', function(req, res) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    var festival = op.get(festivals, req.params.festival_id)
    res.render('festival', {
        'festival': festival
    })
    res.end()
})

router.prepare = function prepareFestivals(callback) {
    // var festivals = {}
    async.each(SDC.get(['local_entities', 'by_class', 'festival']), function(festivalEntity, callback) {
        op.set(festivals, festivalEntity.id, mapper.event(festivalEntity.id))
        // debug(JSON.stringify(event, null, 2))
        async.each(SDC.get(['relationships', festivalEntity.id, 'event']), function(eid, callback) {
            var event = mapper.event(eid)
            // debug(JSON.stringify(event, null, 2))
            if(event['start-time']) {
                var eventDate = (event['start-time']).slice(0,10)
                var eventTime = (event['start-time']).slice(11,16)
                op.push(festivals, [festivalEntity.id, 'events', eventDate, eventTime], event)
            }
            callback()
        }, function(err) {
            if (err) {
                debug('Failed to prepare festival ' + festivalEntity.id, err)
                callback(err)
                return
            }
            // debug('Festival ' + festivalEntity.id + ' prepared.')
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
