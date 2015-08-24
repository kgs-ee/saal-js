var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {

    var program = []
    var upcoming_events = SDC.get('program_upcoming')
    var upcoming_tours = SDC.get('tours_upcoming')
    if (!upcoming_events) {next(new Error('"upcoming_events" not cached...'))}

            res.render('index', {
                "program": upcoming_events,
                "tours": upcoming_tours
            })
            res.end()
            return

    async.each(
        Object.keys(upcoming_events),
        function(key, callback) {
            var event_date = {date:key, events:[]}
            upcoming_events[key].forEach(function(single_event) {
                event_date.events.push(single_event)
            })
            program.push(event_date)
            callback()
        },
        function(error) {
            if (error) {
                debug('2', error)
            }
            debug('c',JSON.stringify(program, null, '  '))
            res.render('index', {
                "program": program
            })
            res.end()
        }
    )
})


module.exports = router
