var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')


function renderTours(res, year, month) {
    // console.log('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    var toursA = {}
    var minDate = false
    var maxDate = new Date()
    async.each(SDC.get(['local_entities', 'by_class', 'tour']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug('tour.start-time', JSON.stringify(event['start-time'], null, 4))
        if (!event['start-time']) { return callback() }

        if (new Date(event['start-time']) > maxDate) { maxDate = new Date(event['start-time']) }
        if (minDate === false) { minDate = new Date(event['start-time']) }
        if (new Date(event['start-time']) < minDate) { minDate = new Date(event['start-time']) }

        if (month - 1 !== new Date(event['start-time']).getUTCMonth()) {
            // console.log(month - 1, '!==', new Date(event['start-time']).getUTCMonth())
            return callback()
        }
        if (parseInt(year, 10) !== new Date(event['start-time']).getUTCFullYear()) {
            // console.log(year, '!==', new Date(event['start-time']).getUTCFullYear())
            return callback()
        }

        var eventDate = (event['start-time']).slice(0,10)
        var eventTime = (event['start-time']).slice(11,16)
        op.set(event, 'event-date', eventDate)
        op.set(event, 'event-time', eventTime)
        op.push(toursA, [eventDate, eventTime], event)
        callback()
    }, function(err) {
        if (err) {
            console.log('Failed to render tours.', err)
            return
        }
        if (year < minDate.getUTCFullYear() ||
            ( year === minDate.getUTCFullYear() && month < minDate.getUTCMonth() + 1 )) {
            debug('Correcting date from Y:' + year + ' M:' + month + ' to Y:' + minDate.getUTCFullYear() + ' M:' + (minDate.getUTCMonth() + 1))
            renderTours(res, minDate.getUTCFullYear(), minDate.getUTCMonth() + 1)
            return
        }

        res.render('tours', {
            'monthNav': helper.monthNav(year, month),
            'tours': toursA,
            'minDate': minDate,
            'maxDate': maxDate
        })
        res.end()
    })
}

router
    .get('/', function(req, res) {
        var year = new Date().getUTCFullYear()
        var month = new Date().getUTCMonth() + 1
        debug('Assuming ' + year + '/' + month )
        renderTours(res, year, month)
        res.end()
    })
    .get('/:year/:month/:categories*?', function(req, res) {
        // debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderTours(res, req.params.year, req.params.month)
    })

module.exports = router
