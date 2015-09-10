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

    var result = ALL_EVENTS_SIFTER.search(req.path.split('/')[1], {
        fields: ['id'],
        limit: 2
    })
    // debug(ALL_EVENTS[result.items[0].id])
    res.render('event', {
        "event": ALL_EVENTS[result.items[0].id]
    })
    res.end()
    return
})


module.exports = router
