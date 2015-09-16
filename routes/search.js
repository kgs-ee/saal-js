var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var fuse    = require('fuse.js')                // http://kiro.me/exp/fuse.html
// var fuzzy   = require('fuzzy')                  // https://github.com/mattyork/fuzzy


router.get('/', function(req, res, next) {
    debug('querystring ', req.query)

    var results = { "query": req.query.q, "query_type": 'query' }
    var query = req.query.q
    res.locals.q = query

    if (query.split(':')[0] === 'date') {
        results['query_type'] = 'date'
        var date = query.split(':')
        date.shift()
        date = date.join(':')
        debug('Looking for date "' + date + '"')
        results = {
            "query_type": 'date'
            , "query_date": date
            , "events": require(path.join(APP_CACHE_DIR, 'calendar.json'))[date]
        }
    } else if (query.split(':')[0] === 'category') {
        results['query_type'] = 'category'
        var category = query.split(':')
        category.shift()
        category = category.join(':')
        debug('Looking for category "' + category + '"')
        var fuse_options = {
            includeScore: true,
            keys: [
                'category.value',
                'performance.category.value'
                ]
        }
        results = {
            "query_type": 'category'
            , "query_category": category
            , "fuse_js": new fuse(ALL_EVENTS, fuse_options).search(category)
        }
        // debug(JSON.stringify(results, null, '  '))
    } else if (query) {
        debug('Looking for "' + query + '"')
        var fuse_options = {
            caseSensitive: false,
            includeScore: true,
            shouldSort: true,
            threshold: 0.6,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            keys: [
                res.locals.lang + '-name',
                res.locals.lang + '-description',
                res.locals.lang + '-technical-information',
                'performance.' + res.locals.lang + '-name',
                'performance.' + res.locals.lang + '-description',
                'performance.' + res.locals.lang + '-technical-information'
                ]
        }
        // var fuzzy_options = {
        //     pre: '<b class="matched">',
        //     post: '</b>',
        //     extract: function(el) { return el.name + ' ' + el.description; }
        // }

        results = {
            "query_type": 'query'
            , "query": req.query.q
            , "fuse_js": new fuse(ALL_EVENTS, fuse_options).search(req.query.q)
            // , "fuzzy": fuzzy.filter(req.query.q, ALL_EVENTS, fuzzy_options)
        }
    } else {
        return next()
    }
    debug(JSON.stringify(results, null, '  '))
    res.render('search', {
        results: results
    })
    res.end()
})


module.exports = router
