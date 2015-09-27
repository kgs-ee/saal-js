var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var program_upcoming = {}
var tours_upcoming = {}
var residency_past = {}

router.get('/', function(req, res, next) {

    if (!SDC.get('program_upcoming')) {
        debug(res.locals.t('error.cache_missing_upcoming_events'))
    }
    if (!SDC.get('tours_upcoming')) {
        debug(res.locals.t('error.cache_missing_upcoming_tours'))
    }
    if (!SDC.get('residency_past')) {
        debug(res.locals.t('error.cache_missing_residency_past'))
    }

    res.render('index', {
        "program": program_upcoming,
        "tours": tours_upcoming,
        "residencies": residency_past,
        path: req.path
    })
    res.end()
    return
})

router.prepare = function prepare(callback) {
    debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    program_upcoming = {}
    parallelf.push(prepareUpcomingEvents)
    tours_upcoming = {}
    parallelf.push(prepareUpcomingTours)
    residency_past = {}
    parallelf.push(preparePastResidency)
    async.parallel(parallelf, function(err) {
        debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

// Upcoming events
var prepareUpcomingEvents = function prepareUpcomingEvents(callback) {
    async.each(SDC.get(['local_entities', 'by_class', 'program']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug(JSON.stringify(event, null, 2))
        event['start-time'].forEach(function(sttime) {
            var event_date = (sttime).slice(0,10)
            var event_time = (sttime).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(program_upcoming, [event_date, event_time], event)
        })
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare past residency.', err)
            callback(err)
            return
        }
        debug('Past residency prepared.', JSON.stringify(program_upcoming, null, 2))
        callback()
    })
}

// Upcoming tours
var prepareUpcomingTours = function prepareUpcomingTours(callback) {
    async.each(SDC.get(['local_entities', 'by_class', 'tour']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug(JSON.stringify(event, null, 2))
        event['start-time'].forEach(function(sttime) {
            var event_date = (sttime).slice(0,10)
            var event_time = (sttime).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(tours_upcoming, [event_date, event_time], event)
        })
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare upcoming tours.', err)
            callback(err)
            return
        }
        debug('Upcoming tours prepared.', JSON.stringify(program_upcoming, null, 2))
        callback()
    })
}

// Past residency
var preparePastResidency = function preparePastResidency(callback) {
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
            debug('Failed to prepare upcoming events.', err)
            callback(err)
            return
        }
        debug('Upcoming events prepared.', JSON.stringify(program_upcoming, null, 2))
        callback()
    })
}

module.exports = router
