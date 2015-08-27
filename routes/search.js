var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var fuse    = require('fuse.js')


router.get('/', function(req, res, next) {
    debug('Looking for "' + req.query.q + '"')
    // debug(JSON.stringify(SDC.get('events'), null, '  '))
    res.locals.q = req.query.q

    var options = {
        caseSensitive: false,
        includeScore: true,
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        keys: ["name","description"]
    }

    var results = new fuse(ALL_EVENTS, options).search(req.query.q)

    debug(JSON.stringify(results, null, '  '))

    res.render('search', {
        results: results
    })
    res.end()
})


module.exports = router
