var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')


router
    .get('/', function(req, res, next) {
        var year = new Date().getUTCFullYear()
        var month = new Date().getUTCMonth() + 1
        debug('Assuming ' + year + '/' + month )
        renderTours(res, year, month, undefined)
        res.end()
    })
    .get('/:year/:month/:categories*?', function(req, res, next) {
        // debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderTours(res, req.params.year, req.params.month, req.params.categories)
    })

var renderTours = function renderTours(res, year, month, categories) {
    // console.log('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    tours_a = {}
    async.each(SDC.get(['local_entities', 'by_class', 'tour']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // console.log(JSON.stringify(event, null, 2))
        if (event['start-time']) {

            if (month - 1 !== new Date(event['start-time']).getUTCMonth()) {
                // console.log(month - 1, '!==', new Date(event['start-time']).getUTCMonth())
                return callback()
            }
            if (parseInt(year) != new Date(event['start-time']).getUTCFullYear()) {
                // console.log(year, '!==', new Date(event['start-time']).getUTCFullYear())
                return callback()
            }

            var event_date = (event['start-time']).slice(0,10)
            var event_time = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(tours_a, [event_date, event_time], event)
        }
        callback()
    }, function(err) {
        if (err) {
            console.log('Failed to render tours.', err)
            callback(err)
            return
        }
        res.render('tours', {
            "monthNav": helper.monthNav(year, month),
            "tours": tours_a,
        })
        res.end()
    })
}

router.prepare = function prepare(callback) {
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
        callback()
    })
}

module.exports = router
