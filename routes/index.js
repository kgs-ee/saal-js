var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {
    debug('Loading "' + req.url + '"', req.params.lang)

    var program = []
    var upcoming_events = SDC.get('event_upcoming')
    // debug(Object.keys(upcoming_events))
    if (!upcoming_events) {next(new Error('Cache not ready...'))}
    async.each(
        Object.keys(upcoming_events).sort(),
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
                "op": op,
                "program": program
            })
            res.end()
        }
    )
})


module.exports = router
