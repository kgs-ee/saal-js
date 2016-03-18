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
    date.setHours(0)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
}
function formatDate(date) {
    if (Object.prototype.toString.call(date) !== '[object Date]') { date = new Date(date) }
    return date.getFullYear() + '-' + (Number(date.getMonth())+1) + '-' + date.getDate()
}

var maxDate = new Date()
var minDate = new Date()
minDate.setDate(1)
minDate.setMonth(minDate.getMonth() - 1)
if (minDate < new Date('2016-01-01')) { minDate = new Date('2016-01-01') }
truncDate(minDate)

router.get('/', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    var date = op.get(req, 'query.date')
    if (date) {
        res.send(eventCalendar[date])
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

        //debug(JSON.stringify(oneEvent, null, 2))
        if (!oneEvent['start-time']) { return callback() }
        if (new Date(oneEvent['start-time']) < minDate) { return callback() }
        if (SDC.get(['relationships', oneEvent.id, 'parent'], []).indexOf(residenciesEid) !== -1) { return callback() }
        if (new Date(oneEvent['start-time']) > maxDate) { maxDate = new Date(oneEvent['start-time']) }

        calEvent.eid = op.get(oneEvent, ['performance', 'id'], op.get(oneEvent, ['id']))
        calEvent.controller = op.get(oneEvent, ['performance', 'id'], false) ? 'performance' : 'event'
        calEvent.tag = op.get(oneEvent, ['tag'], [])
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
