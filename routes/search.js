var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var fuse    = require('fuse.js')                // http://kiro.me/exp/fuse.html
var fuzzy   = require('fuzzy')                  // https://github.com/mattyork/fuzzy


router.get('/', function(req, res, next) {
    debug('Looking for "' + req.query.q + '"')
    // debug(JSON.stringify(SDC.get('events'), null, '  '))
    res.locals.q = req.query.q

    var fuse_options = {
        caseSensitive: false,
        includeScore: true,
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        keys: ["name","description"]
    }
    var fuzzy_options = {
        pre: '<b class="matched">',
        post: '</b>',
        extract: function(el) { return el.name + ' ' + el.description; }
    }

    var results = {
        "fuse_js": new fuse(ALL_EVENTS, fuse_options).search(req.query.q),
        "fuzzy": fuzzy.filter(req.query.q, ALL_EVENTS, fuzzy_options)
    }

    debug(JSON.stringify(results.fuse_js, null, '  '))

    res.render('search', {
        results: results
    })
    res.end()
})


module.exports = router
