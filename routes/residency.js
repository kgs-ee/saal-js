var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var residency_past = {}

router.get('/', function(req, res, next) {
    debug('Loading "' + req.url + '"')

    // res.locals.lang = req.params.lang
    res.render('residency', {
        "residencies": residency_past
    })
    res.end()
})

router.prepare = function prepare(callback) {
    debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(preparePastResidency)
    async.parallel(parallelf, function(err) {
        debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

// Past residency
var preparePastResidency = function preparePastResidency(callback) {
    residency_past = {}
    async.each(SDC.get(['local_entities', 'by_class', 'residency']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug(JSON.stringify(event, null, 2))
        event['start-time'].forEach(function(sttime) {
            var event_date = (sttime).slice(0,10)
            var event_time = (sttime).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(residency_past, [event_date, event_time], event)
        })
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare past residency.', err)
            callback(err)
            return
        }
        debug('Past residency prepared.')
        callback()
    })
}

module.exports = router
