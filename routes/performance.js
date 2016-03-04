var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

router.get('/:id', function(req, res) {
    // debug('querystring ', req.query)

    var performanceEid = req.path.split('/')[1]
    var performance = mapper.performance(performanceEid, op.get(req, ['query', 'q'], null))
    // debug(JSON.stringify(performance, null, 4))
    var events = []
    var pastEvents = []
    var coverages = mapper.coverageByPerformanceSync(performanceEid)
    SDC.get(['relationships', performanceEid, 'event'], [])
    .map(function(eId) { return mapper.event(eId, op.get(req, ['query', 'q'], null)) })
    .sort(function(a, b) { return (new Date(a['start-time'])) > (new Date(b['start-time'])) })
    .forEach(function(event) {
        if (new Date() < new Date(event['start-time'])) {
            events.push(event)
        } else {
            pastEvents.push(event)
        }
    })
    events.sort(function(a, b) { return a['start-time'] > b['start-time'] ? 1 : -1 })
    pastEvents.sort(function(a, b) { return a['start-time'] < b['start-time'] ? 1 : -1 })

    var rootCategories = Object.keys(SDC.get(['local_entities', 'by_class', 'rootCategory'], {}))
        .map(function(eId) {
            var mappedCategory = mapper.category(eId)
            eId = String(eId)
            mappedCategory.checked = false
            var perfCatIds = SDC.get(['relationships', performanceEid, 'category'], [])
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
        'pastEvents': pastEvents,
        'coverage': coverages,
        'id': performance.id,
        'rootCategories': rootCategories
    })
    res.end()
    return
})

debug(path.basename(__filename).replace('.js', '') + ' controller loaded.')

module.exports = router
