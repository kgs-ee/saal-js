var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')

function renderProgram(res, year, month, categories) {
    // console.log('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    var all_categories = SDC.get(['local_entities', 'by_class', 'rootCategory'], {})
    if (!categories) {
        categories = Object.keys(all_categories).map( function(key) { return parseInt(key, 10) })
    } else {
        categories = categories.split(',').map(function(eid){return parseInt(eid, 10)})
    }
    categories.sort(function(a,b){return a-b})

    var program_a = {}
    async.each(SDC.get(['local_entities', 'by_class', 'program']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // console.log(JSON.stringify(event, null, 2))
        if (event['start-time']) {

            var performance_eid = op.get(event, ['performance', 'id'])
            var perfCatIds = SDC.get(['relationships', performance_eid, 'category'], []).map(function(eId) { return parseInt(eId, 10) })
            // debug('a', perfCatIds, pr_categories)
            perfCatIds.sort(function(a,b){return a-b})
            // debug('ab', perfCatIds, pr_categories)

            var intersects = false
            var ai = 0, bi = 0
            while( ai < perfCatIds.length && bi < categories.length && !intersects )
            {
                if      (perfCatIds[ai] < categories[bi]) { ai = ai + 1 }
                else if (perfCatIds[ai] > categories[bi]) { bi = bi + 1 }
                else { intersects = true }
            }

            if (intersects) {
                // console.log(event.id, categories, ' intersects ', JSON.stringify(perfCatIds))
            } else {
                // console.log(event.id, categories, ' doesnot intersect ', JSON.stringify(perfCatIds))
                return callback()
            }

            if (month - 1 !== new Date(event['start-time']).getUTCMonth()) {
                // console.log(month - 1, '!==', new Date(event['start-time']).getUTCMonth())
                return callback()
            }
            if (parseInt(year, 10) !== new Date(event['start-time']).getUTCFullYear()) {
                // console.log(year, '!==', new Date(event['start-time']).getUTCFullYear())
                return callback()
            }

            var event_date = (event['start-time']).slice(0,10)
            var event_time = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(program_a, [event_date, event_time], event)
        }
        callback()
    }, function(err) {
        if (err) {
            console.log('Failed to render program.', err)
            callback(err)
            return
        }
        res.render('program', {
            'monthNav': helper.monthNav(year, month),
            'categories': categories,
            'all_categories': all_categories,
            'program': program_a,
            'arraySubtract': helper.arraySubtract,
        })
        res.end()
    })
}

router
    // .get('/', function(req, res, next) {
    .get('/', function(req, res) {
        var year = new Date().getUTCFullYear()
        var month = new Date().getUTCMonth() + 1
        // console.log('Assuming ' + year + '/' + month )
        renderProgram(res, year, month, undefined)
        res.end()
    })
    // .get('/:year/:month/:categories*?', function(req, res, next) {
    .get('/:year/:month/:categories*?', function(req, res) {
        // console.log('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderProgram(res, req.params.year, req.params.month, req.params.categories)
    })


module.exports = router
