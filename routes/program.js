var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')

router
    .get('/', function(req, res, next) {
        var year = new Date().getUTCFullYear()
        var month = new Date().getUTCMonth() + 1
        // console.log('Assuming ' + year + '/' + month )
        renderProgram(res, year, month, undefined)
        res.end()
    })
    .get('/:year/:month/:categories*?', function(req, res, next) {
        // console.log('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderProgram(res, req.params.year, req.params.month, req.params.categories)
    })

var renderProgram = function renderProgram(res, year, month, categories) {
    // console.log('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    var all_categories = SDC.get(['local_entities', 'by_class', 'category'], {})
    if (!categories) {
        categories = Object.keys(all_categories).map( function(key) { return parseInt(key) })
    } else {
        categories = categories.split(',').map(function(eid){return parseInt(eid)})
    }
    categories.sort(function(a,b){return a-b})

    program_a = {}
    async.each(SDC.get(['local_entities', 'by_class', 'program']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // console.log(JSON.stringify(event, null, 2))
        if (event['start-time']) {

            var pr_categories = op.get(event, ['performance', 'category'], []).map(function(category) { return category.id })
            pr_categories.sort(function(a,b){return a-b})
            // console.log(event.id, categories, '?==', JSON.stringify(pr_categories))

            var intersects = false
            var ai = 0, bi = 0
            while( ai < pr_categories.length && bi < categories.length && !intersects )
            {
                if      (pr_categories[ai] < categories[bi]) { ai++ }
                else if (pr_categories[ai] > categories[bi]) { bi++ }
                else { intersects = true }
            }

            if (intersects) {
                // console.log(event.id, categories, ' intersects ', JSON.stringify(pr_categories))
            } else {
                // console.log(event.id, categories, ' doesnot intersect ', JSON.stringify(pr_categories))
                return callback()
            }

            if (month - 1 !== new Date(event['start-time']).getUTCMonth()) {
                // console.log(month - 1, '!==', new Date(event['start-time']).getUTCMonth())
                return callback()
            }
            if (parseInt(year) != new Date(event['start-time']).getUTCFullYear()) {
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
            "monthNav": helper.monthNav(year, month),
            "categories": categories,
            "all_categories": all_categories,
            "program": program_a,
            "arraySubtract": helper.arraySubtract,
        })
        res.end()
    })
}


module.exports = router
