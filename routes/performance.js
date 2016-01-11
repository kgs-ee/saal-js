var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
// var op      = require('object-path')

var mapper  = require('../helpers/mapper')

router.get('/:id', function(req, res) {

    var performance_eid = req.path.split('/')[1]
    var performance = mapper.performance(performance_eid)
    // debug(JSON.stringify(performance, null, 4))
    var events = []
    var past_events = []
    var coverages = mapper.coverageByPerformanceSync(performance_eid)
    SDC.get(['relationships', performance_eid, 'event'], []).forEach(function(event_eid) {
        var event = mapper.event(event_eid)
        //debug(JSON.stringify(event, null, 2))
        if (new Date() < new Date(event['start-time'])) {
            events.push(event)
        } else {
            past_events.push(event)
        }
    })

    var rootCategories = Object.keys(SDC.get(['local_entities', 'by_class', 'rootCategory'], {}))
        .map(function(eId) {
            var mappedCategory = mapper.category(eId)
            eId = String(eId)
            mappedCategory.checked = false
            var perfCatIds = SDC.get(['relationships', performance_eid, 'category'], [])
            // debug(perfCatIds, perfCatIds.indexOf(eId), eId)
            if (perfCatIds.indexOf(eId) > -1) {
                mappedCategory.checked = true
            }
            return mappedCategory
        })

    // debug(JSON.stringify(rootCategories, null, 4))

    res.render('performance', {
        'performance': performance,
        'events': events,
        'past_events': past_events,
        'coverage': coverages,
        'id': performance.id,
        'rootCategories': rootCategories
    })
    res.end()
    return
})

debug(path.basename(__filename).replace('.js', '') + ' controller loaded.')

module.exports = router
