var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')


function renderEcho(res, currentEchoId) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    var echoA = {}
    var minDate = false
    var maxDate = false
    var latestEchoId
    var featuredEchoId
    async.each(SDC.get(['local_entities', 'by_class', 'echo']), function(entity, callback) {
        var echo = mapper.echo(entity.id)
        if (!echo['date']) { return callback() }

        if (echo.featured) {
            featuredEchoId = echo.id
        }
        if (maxDate === false || new Date(echo['date']) > maxDate) {
            maxDate = new Date(echo['date'])
            latestEchoId = echo.id
        }
        if (minDate === false || new Date(echo['date']) < minDate) { minDate = new Date(echo['date']) }

        op.push(echoA, [echo.year, echo.month, echo.day], echo)
        callback()
    }, function(err) {
        if (err) {
            console.log('Failed to render echo.', err)
            return
        }

        currentEchoId = (currentEchoId ? currentEchoId : (featuredEchoId ? featuredEchoId : latestEchoId))

        var echoCategories = Object.keys(SDC.get(['local_entities', 'by_class', 'echoCategory'], {}))
            .map(function(eId) {
                var mappedCategory = mapper.category(eId)
                eId = String(eId)
                mappedCategory.checked = false
                var echoCatIds = SDC.get(['relationships', currentEchoId, 'category'], [])
                // debug(echoCatIds, echoCatIds.indexOf(eId), eId)
                if (echoCatIds.indexOf(eId) > -1) {
                    mappedCategory.checked = true
                }
                return mappedCategory
            })

        res.render('magazine', {
            'echo': mapper.echo(currentEchoId),
            'echoArray': echoA,
            'echoCategories': echoCategories,
            'minDate': minDate,
            'maxDate': maxDate
        })
        res.end()
    })
}

router
    .get('/', function(req, res) {
        renderEcho(res)
        res.end()
    })
    .get('/:id', function(req, res) {
        debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderEcho(res, req.params.id)
    })


module.exports = router
