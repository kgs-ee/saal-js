var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var residency = {}

router.get('/', function(req, res) {
    debug('Loading "' + req.url + '"')

    res.render('residency', {
        'residencies': residency
    })
    res.end()
})

function prepareResidency(callback) {
    residency = {}
    async.each(SDC.get(['local_entities', 'by_class', 'residency']), function(entity, callback) {
        var event = mapper.event(entity.id)
        if (!op.get(event, ['start-time'], false)) {
            debug('Skipping residency eid=' + event.id + ' because missing start time.')
            return callback()
        }
        if (!op.get(event, ['saal-location', 'id'], false)) {
            debug('Skipping residency eid=' + event.id + ' because missing location.')
            return callback()
        }
        var eventDate = op.get(event, ['start-time'].slice(0,10))
        // debug(JSON.stringify(residency, null, 2))
        // debug(JSON.stringify(event, null, 2))
        op.push(residency, [eventDate], event)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare residency.', err)
            callback(err)
            return
        }
        // debug('Residency prepared.', JSON.stringify(residency, null, 2))
        callback()
    })
}

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareResidency)
    async.parallel(parallelf, function(err) {
        if (err) { return callback(err) }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

module.exports = router
