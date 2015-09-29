var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

router.get('/:id', function(req, res, next) {
    // debug('Looking for', req.query)
    // debug('Looking for', req.path)

    var event_eid = req.path.split('/')[1]
    var event = mapper.event(event_eid)
    var coverages = SDC.get(['relationships', event_eid, 'coverage'], []).map(function(eid) {
        return mapper.coverage(eid)
    })
    if ( performance_id = parseInt(SDC.get(['relationships', event_eid, 'performance', 0]))) {
        coverages = coverages.concat(SDC.get(['relationships', performance_id, 'coverage'], []).map(function(eid) {
            return mapper.coverage(eid)
        }))
    }
    res.render('event', {
        "event": event,
        "coverage": coverages
    })
    res.end()
    return
})


module.exports = router
