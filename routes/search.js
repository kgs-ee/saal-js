var fs      = require('fs')
var express = require('express')
var request = require('request')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var fuse    = require('fuse.js')                // http://kiro.me/exp/fuse.html
// var fuzzy   = require('fuzzy')                  // https://github.com/mattyork/fuzzy


router.get('/', function(req, res, next) {
    debug('querystring ', req.query)

    var results = {}
    var query = req.query.q
    res.locals.q = query

    if (query.split(':')[0] === 'date') {
        var date = query.split(':')
        date.shift()
        date = date.join(':')
        debug('Looking for date "' + date + '"')
        results = {
            "query_type": 'date'
            , "query_date": date
            , "events": require(path.join(APP_CACHE_DIR, 'calendar.json'))[date]
        }
        debug(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    } else if (query.split(':')[0] === 'category') {
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
        debug(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    } else if (query.split(':')[0] === 'person') {
        var person = query.split(':')
        person.shift()
        person = person.join(':')
        debug('Looking for person "' + person + '"')
        var fuse_options = {
            includeScore: true,
            keys: [
                'name',
                'email',
                'phone'
                ]
        }
        results = {
            "query_type": 'person'
            , "query_person": person
            , "fuse_js": new fuse(require(path.join(APP_CACHE_DIR, 'users_all.json')), fuse_options).search(person)
        }
        debug(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    } else if (query.split(':')[0] === 'giphy') {
        var giphy = query.split(':')
        giphy.shift()
        giphy = giphy.join(':')
        debug('Looking for giphy "' + giphy + '"')

        request({
            url: 'http://api.giphy.com/v1/gifs/search?q=' + giphy + '&api_key=dc6zaTOxFJmzC',
            json: true
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                console.log(body) // Print the json response
                results = {
                    "query_type": 'giphy'
                    , "query_giphy": giphy
                    , "giphy": body
                }
                debug(JSON.stringify(results, null, '  '))
                res.render('search', {
                    results: results
                })
                res.end()
            }
        })
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
        debug(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    } else {
        return next()
    }
})


module.exports = router
