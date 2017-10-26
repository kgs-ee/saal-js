var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var festivals = {}

router.get('/', function(req, res) {
    debug('Loading "' + req.url + '"')

    res.render('festivals', {
        'festivals': festivals
    })
    res.end()
})

function prepareFestivals(callback) {
    festivals = {}
    async.each(SDC.get(['local_entities', 'by_class', 'festival']), function(entity, callback) {
        if (entity.definition !== 'event') {
          debug('Skipping eid=' + entity.id + ' because not an event.')
          return callback()
        }
        var festival = mapper.event(entity.id)
        // if (!op.get(festival, ['start-time'], false)) {
        //     debug('Skipping residency eid=' + festival.id + ' because missing start time.')
        //     return callback()
        // }
        // if (!op.get(festival, ['saal-location', 'id'], false)) {
        //     debug('Skipping residency eid=' + festival.id + ' because missing location.')
        //     return callback()
        // }
        var eventDate = op.get(festival, ['start-time'].slice(0,10))
        debug(JSON.stringify(festival['start-time'], null, 2))
        op.push(festivals, [eventDate], festival)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare festivals.', err)
            callback(err)
            return
        }
        // debug('Festivals prepared.', JSON.stringify(festivals, null, 2))
        callback()
    })
}

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareFestivals)
    async.parallel(parallelf, function(err) {
        if (err) { return callback(err) }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

module.exports = router
