var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/:id', function(req, res, next) {
    debug('Looking for', req.query)
    debug('Looking for', req.path)

    debug(EVENT_LOOKUP)
    debug(ALL_EVENTS[EVENT_LOOKUP[req.path.split('/')[1]]])
    res.render('event', {
        "event": ALL_EVENTS[EVENT_LOOKUP[req.path.split('/')[1]]]
    })
    res.end()
    return
})


module.exports = router
