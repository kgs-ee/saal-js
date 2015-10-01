var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

router.get('/:id', function(req, res, next) {
    // debug('Looking for', req.query)
    // debug('Looking for', req.path)

    var performance_eid = req.path.split('/')[1]
    var performance = mapper.performance(performance_eid)
    var events = []
    var coverages = SDC.get(['relationships', performance_eid, 'coverage'], []).map(function(eid) {
        return mapper.coverage(eid)
    })
    // debug(JSON.stringify(SDC.get(['relationships', performance_eid, 'event'], []), null, 2))
    SDC.get(['relationships', performance_eid, 'event'], []).forEach(function(event_eid) {
        var event = mapper.event(event_eid)
        // debug(new Date(), event['start-time'][0], new Date(event['start-time'][0]))
        if (new Date() < new Date(event['start-time'][0])) {
            events.push(event)
        }

        coverages = coverages.concat(
            SDC.get(['relationships', event_eid, 'coverage'], []).map(function(eid) {
                return mapper.coverage(eid)
            })
        )
    })

    res.render('performance', {
        "performance": performance,
        "events": events,
        "coverage": coverages
    })
    res.end()
    return
})


module.exports = router
