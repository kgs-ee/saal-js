var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

router.get('/:id', function(req, res, next) {

    var performance_eid = req.path.split('/')[1]
    var performance = mapper.performance(performance_eid)
    var events = []
    var past_events = []
    var coverages = mapper.coverageByPerformanceSync(performance_eid)
    SDC.get(['relationships', performance_eid, 'event'], []).forEach(function(event_eid) {
        var event = mapper.event(event_eid)
        //debug(JSON.stringify(event, null, 2))
        if (new Date() < new Date(event['start-time'][0])) {
            events.push(event)
        } else {
            past_events.push(event)
        }
    })

    res.render('performance', {
        "performance": performance,
        "events": events,
        "past_events": past_events,
        "coverage": coverages,
        "id": performance.id
    })
    res.end()
    return
})


module.exports = router
