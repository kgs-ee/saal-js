var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var eventCalendar = {}

// function pad2(d) { return (d < 10) ? '0' + d.toString() : d.toString() }
function truncDate(date) {
    date.setUTCHours(0)
    date.setUTCMinutes(0)
    date.setUTCSeconds(0)
    date.setUTCMilliseconds(0)
}
function formatDate(date) {
    if (Object.prototype.toString.call(date) !== '[object Date]') { date = new Date(date + 'Z') }
    return date.getFullYear() + '-' + (Number(date.getMonth())+1) + '-' + date.getDate()
}

var maxDate = new Date()
var minDate = new Date()
minDate.setDate(1)
minDate.setMonth(minDate.getMonth() - 1)
if (minDate < new Date('2016-01-01Z')) { minDate = new Date('2016-01-01Z') }
truncDate(minDate)

router.get('/', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    var date = op.get(req, 'query.date')
    if (date) {
        res.send(eventCalendar[date])
        // res.send(eventCalendar[date].map(function(e){ return {cal:e, event:mapper.event(e.eid)} }))
    } else {
        maxDate.setDate(1)
        maxDate.setMonth(maxDate.getMonth() + 1)
        maxDate.setDate(maxDate.getDate() - 1)
        truncDate(maxDate)

        res.send({
            minDate: formatDate(minDate),
            maxDate: formatDate(maxDate),
            events: eventCalendar,
        })
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
        var calEvent = {}
        if (!oneEvent['start-time']) { return callback() }
        var startDateTime = new Date(oneEvent['start-time'] + 'Z')
        if (startDateTime < minDate) { return callback() }
        // if (SDC.get(['relationships', oneEvent.id, 'parent'], []).indexOf(residenciesEid) !== -1) { return callback() }
        if (startDateTime > maxDate) { maxDate = startDateTime }

        calEvent.eid = op.get(oneEvent, ['performance', 'id'], op.get(oneEvent, ['id']))
        calEvent.tag = op.get(oneEvent, ['tag'], [])
        if (oneEvent.resident) {
          callback()
          return
          calEvent.controller = 'resident'
          calEvent.tag = ['event']
        }
        else if (op.get(oneEvent, ['performance', 'id'], false) !== false) {
          calEvent.controller = 'performance'
        }
        else {
          calEvent.controller = 'event'
        }
        // calEvent.controller = op.get(oneEvent, ['performance', 'id'], false) ? 'performance' : 'event'
        op.set(calEvent, ['name', 'et'], op.get(oneEvent, ['et-name']) === '' ? op.get(oneEvent, ['performance', 'artist']) : op.get(oneEvent, ['et-name']))
        op.set(calEvent, ['name', 'en'], op.get(oneEvent, ['en-name']) === '' ? op.get(oneEvent, ['performance', 'artist']) : op.get(oneEvent, ['en-name']))

        calEvent.time = ''
        if (oneEvent['start-time'].length >= 16) {
            calEvent.time = oneEvent['start-time'].slice(11,16).replace('00:00', '')
        }

        calEvent.location = {}
        calEvent.location.et = op.get(oneEvent, ['saal-location', 'et-name'], op.get(oneEvent, ['et-location'], 'Asukoht määramata!'))
        calEvent.location.en = op.get(oneEvent, ['saal-location', 'en-name'], op.get(oneEvent, ['en-location'], 'Location missing'))

        op.push(eventCalendar, [formatDate(oneEvent['start-time'].slice(0,10))], calEvent)
        if (oneEvent['end-time']) {
          var startD = new Date(oneEvent['start-time'] + 'Z')
          truncDate(startD)
          startD = new Date(startD.getTime() + 86400000)
          var endD = new Date(oneEvent['end-time'] + 'Z')
          truncDate(endD)
          calEventC = JSON.parse(JSON.stringify(calEvent))
          calEventC.time = ''
          while (endD >= startD) {
            op.push(eventCalendar, [formatDate(startD.toISOString().slice(0,10))], calEventC)
            startD = new Date(startD.getTime() + 86400000)
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
