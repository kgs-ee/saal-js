var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var featured = {}
var program_upcoming = {}
var tours_upcoming = {}
var residency_past = {}

router.get('/', function(req, res) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    res.render('index', {
        "featured": featured,
        "program": program_upcoming,
        "tours": tours_upcoming,
        "residencies": residency_past,
        path: req.path
    })
    res.end()
    return
})


// Featured performamces
function prepareFeatured(callback) {
    featured = []
    async.each(SDC.get(['local_entities', 'featured']), function(entity, callback) {
        featured.push(mapper.performance(entity.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare featured performances.', err)
            callback(err)
            return
        }
        // debug('Featured performances prepared.')
        callback()
    })
}

// Upcoming events
function prepareUpcomingEvents(callback) {
    program_upcoming = {}
    async.each(SDC.get(['local_entities', 'by_class', 'program']), function(entity, callback) {
        var event = mapper.event(entity.id)
        if (event['start-time']) {
            if (new Date() > new Date(event['start-time'])) {
                return
            }
            // debug(new Date().toJSON(), event['start-time'], new Date(event['start-time']).toJSON())
            var event_date = (event['start-time']).slice(0,10)
            var event_time = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(program_upcoming, [event_date, event_time], event)
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare upcoming events.', err)
            callback(err)
            return
        }
        // debug('Upcoming events prepared.')
        callback()
    })
}

// Upcoming tours
function prepareUpcomingTours(callback) {
    tours_upcoming = {}
    async.each(SDC.get(['local_entities', 'by_class', 'tour']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug(JSON.stringify(event, null, 2))
        if (event['start-time']) {
            var event_date = (event['start-time']).slice(0,10)
            var event_time = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(tours_upcoming, [event_date, event_time], event)
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare upcoming tours.', err)
            callback(err)
            return
        }
        // debug('Upcoming tours prepared.')
        callback()
    })
}

// Past residency
function preparePastResidency(callback) {
    residency_past = {}
    async.each(SDC.get(['local_entities', 'by_class', 'residency']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // console.log(JSON.stringify(event, null, 2))
        if (event['start-time']) {
            var event_date = (event['start-time']).slice(0,10)
            var event_time = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(residency_past, [event_date, event_time], event)
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare past residency.', err)
            callback(err)
            return
        }
        // debug('Past residency prepared.')
        callback()
    })
}


router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareFeatured)
    parallelf.push(prepareUpcomingEvents)
    parallelf.push(prepareUpcomingTours)
    parallelf.push(preparePastResidency)
    async.parallel(parallelf, function(err) {
        if (err) { return callback(err) }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

module.exports = router
