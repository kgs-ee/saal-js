var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')

// var program_upcoming = []

router
    .get('/', function(req, res, next) {
        var year = new Date().getUTCFullYear()
        var month = new Date().getUTCMonth() + 1
        debug('Assuming ' + year + '/' + month )
        renderProgram(res, year, month, undefined)
        res.end()
    })
    .get('/:year/:month/:categories*?', function(req, res, next) {
        debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderProgram(res, req.params.year, req.params.month, req.params.categories)
    })

var renderProgram = function renderProgram(res, year, month, categories) {
    var all_categories = SDC.get(['local_entities', 'by_class', 'category'])
    if (!categories) {
        categories = Object.keys(all_categories).map( function(key) { return parseInt(key) })
    } else {
        categories = categories.split(',').map(function(eid){return parseInt(eid)})
    }
    categories.sort(function(a,b){return a-b})

    program_a = {}
    async.each(SDC.get(['local_entities', 'by_class', 'program']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug(JSON.stringify(event, null, 2))
        event['start-time'].forEach(function(sttime) {

            var pr_categories = op.get(event, ['performance', 'category'], []).map(function(category) { return category.id })
            pr_categories.sort(function(a,b){return a-b})
            // debug(event.id, categories, '?==', JSON.stringify(pr_categories))

            var intersects = false
            var ai = 0, bi = 0
            while( ai < pr_categories.length && bi < categories.length && !intersects )
            {
                if      (pr_categories[ai] < categories[bi]) { ai++ }
                else if (pr_categories[ai] > categories[bi]) { bi++ }
                else { intersects = true }
            }

            if (intersects) {
                // debug(event.id, categories, ' intersects ', JSON.stringify(pr_categories))
            } else {
                // debug(event.id, categories, ' doesnot intersect ', JSON.stringify(pr_categories))
                return
            }

            if (month - 1 !== new Date(sttime).getUTCMonth()) {
                // debug(month - 1, '!==', new Date(sttime).getUTCMonth())
                return
            }
            if (parseInt(year) != new Date(sttime).getUTCFullYear()) {
                // debug(year, '!==', new Date(sttime).getUTCFullYear())
                return
            }

            var event_date = (sttime).slice(0,10)
            var event_time = (sttime).slice(11,16)
            op.set(event, 'event-date', event_date)
            op.set(event, 'event-time', event_time)
            op.push(program_a, [event_date, event_time], event)
        })
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare program.', err)
            callback(err)
            return
        }
        var subtractCategory = function(val) {
            var ret_arr = []
            categories.forEach(function(category) {
                if (String(val) != String(category)) {
                    ret_arr.push(category)
                }
            })
            return ret_arr
        }
        res.render('program', {
            "monthNav": monthNav(year, month),
            "categories": categories,
            "all_categories": all_categories,
            "program": program_a,
            "subtractCategory": subtractCategory,
        })
        res.end()
    })
}

var monthNav = function monthNav(year, month) {
    month = parseInt(month)
    year = parseInt(year)
    return {
        "prev": {
            "year": month > 1 ? year : year - 1,
            "month": month > 1 ? month - 1 : 12
        },
        "current": {
            "year": year,
            "month": month
        },
        "next": {
            "year": month < 12 ? year : year + 1,
            "month": month < 12 ? month + 1 : 1
        }
    }
}
module.exports = router
