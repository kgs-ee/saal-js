var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var eventCalendar = {}

router.get('/', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    var date = op.get(req, 'query.date')
    if (date) {
        res.send(eventCalendar[date])
    } else {
        res.send(eventCalendar)
    }
    res.end()
})

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    eventCalendar = {}
    var residenciesEid = '1931'
    var events = SDC.get(['local_entities', 'by_definition', 'event'], [])

    async.each(events, function(event, callback) {
        var oneEvent = mapper.event(event.id)
        //debug(JSON.stringify(oneEvent, null, 2))
        if (oneEvent['start-time']) {
            var startTime = '00:00'
            if (oneEvent['start-time'].length === 16) {
                startTime = oneEvent['start-time'].slice(11,16)
            }
            oneEvent.time = startTime
            if (SDC.get(['relationships', oneEvent.id, 'parent'], []).indexOf(residenciesEid) === -1) {
                op.push(eventCalendar, oneEvent['start-time'].slice(0,10), oneEvent)
            }
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare calendar.', err)
            callback(err)
            return
        }
        callback()
    })
}


module.exports = router
