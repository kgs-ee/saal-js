var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var event_calendar = {}

router.get('/', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    var date = op.get(req, 'query.date')
    if (date) {
        res.send(event_calendar[date])
    } else {
        res.send(event_calendar)
    }
    res.end()
})

router.prepare = function prepare(callback) {
    debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    event_calendar = {}
    var events = SDC.get('local_entities.by_definition.event')
    var dates_a = []

    async.each(events, function(event, callback) {
        var one_event = mapper.event(event.id)
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
            debug('Failed to prepare calendar.', err)
            callback(err)
            return
        }
        callback()
    })
}


module.exports = router
