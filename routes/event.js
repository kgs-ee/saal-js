var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/:id', function(req, res, next) {
    // debug('Looking for', req.query)
    // debug('Looking for', req.path)

    // debug(EVENT_LOOKUP)
    var event = ALL_EVENTS[EVENT_LOOKUP[req.path.split('/')[1]]]
    var coverage = op.get(event, 'coverage', []).concat(op.get(event, 'performance.coverage', []))
    // debug('coverage:', op.get(event, 'coverage', 'N/A'))
    // debug('performance.coverage:', op.get(event, 'performance.coverage', 'N/A'))
    // debug('full coverage:', coverage)
    res.render('event', {
        "event": event,
        "coverage": coverage
    })
    res.end()
    return
})


module.exports = router
