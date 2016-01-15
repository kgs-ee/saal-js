var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))

var mapper  = require('../helpers/mapper')


router.get('/:id', function(req, res) {

    var eventEid = req.path.split('/')[1]
    var event = mapper.event(eventEid)

    var rootCategories = Object.keys(SDC.get(['local_entities', 'by_class', 'rootCategory'], {}))
        .map(function(eId) {
            var mappedCategory = mapper.category(eId)
            eId = String(eId)
            mappedCategory.checked = false
            var eventCatIds = SDC.get(['relationships', eventEid, 'category'], [])
            // debug(eventCatIds, eventCatIds.indexOf(eId), eId)
            if (eventCatIds.indexOf(eId) > -1) {
                mappedCategory.checked = true
            }
            return mappedCategory
        })
        // debug(JSON.stringify(rootCategories, null, 4))

    res.render('resident', {
        'event': event,
        'id': event.id,
        'rootCategories': rootCategories
    })
    res.end()
    return
})

debug(path.basename(__filename).replace('.js', '') + ' controller loaded.')

module.exports = router
