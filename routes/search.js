var express = require('express')
var request = require('request')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var fuse    = require('fuse.js')                // http://kiro.me/exp/fuse.html

var mapper  = require('../helpers/mapper')

var all_events = SDC.get(['local_entities', 'by_definition', 'event'])


router.get('/', function(req, res, next) {
    // console.log('querystring ', req.query)

    var results = {}
    var query = req.query.q
    res.locals.q = query

    if (!query) {
        return next()
    }

    var fuse_options = {}

    if (query.split(':')[0] === 'date') {
        var date = query.split(':')
        date.shift()
        date = date.join(':')
        debug('Looking for date "' + date + '"')
        results = {
            'query_type': 'date'
            , 'query_date': date
            , 'events': require(path.join(APP_CACHE_DIR, 'calendar.json'))[date]
        }
        debug(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    } else if (query.split(':')[0] === 'category') {
        var performances = []
        var q_category = query.split(':')
        q_category.shift()
        q_category = q_category.join(':').toLowerCase()
        q_category = q_category.split(',')
        debug('Looking for category "' + JSON.stringify(q_category) + '"')
        async.each(SDC.get(['local_entities', 'by_definition', 'performance']), function(performance_e, callback) {
            var performance = mapper.performance(performance_e.id)
            var categories = op.get(performance, ['category'], [])
            for (ix in categories) {
                if (categories.hasOwnProperty(ix)) {
                    var p_category = categories[ix]
                    if (q_category.indexOf(op.get(p_category, [res.locals.lang + '-name'], '').toLowerCase()) > -1) {
                        performances.push(performance)
                    }
                }
            }
            callback()
        }, function(err) {
            if (err) {
                debug('Failed to search by category.', err)
                callback(err)
                return
            }
            results = {
                'query_type': 'category',
                'query_category': q_category.join(','),
                'performances': performances,
            }
            res.render('search', {
                results: results
            })
            res.end()
        })
    } else if (query.split(':')[0] === 'person') {
        var person = query.split(':')
        person.shift()
        person = person.join(':')
        debug('Looking for person "' + person + '"')
        fuse_options = {
            includeScore: true,
            keys: [
                'name',
                'email',
                'phone'
                ]
        }
        results = {
            'query_type': 'person'
            , 'query_person': person
            , 'fuse_js': new fuse(require(path.join(APP_CACHE_DIR, 'users_all.json')), fuse_options).search(person)
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
                debug(body) // Print the json response
                results = {
                    'query_type': 'giphy'
                    , 'query_giphy': giphy
                    , 'giphy': body
                }
                debug(JSON.stringify(results, null, '  '))
                res.render('search', {
                    results: results
                })
                res.end()
            }
        })
    } else if (query) {
        // console.log('Looking for "' + query + '"')
        fuse_options = {
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

        results = {
            'query_type': 'query'
            , 'query': req.query.q
            , 'fuse_js': new fuse(all_events, fuse_options).search(req.query.q)
            // , 'fuzzy': fuzzy.filter(req.query.q, all_events, fuzzy_options)
        }
        // console.log(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    } else {
        return next()
    }
})


router.prepare = function prepare(callback) {
    all_events = []
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    async.each(SDC.get(['local_entities', 'by_definition', 'event']), function(event, callback) {
        all_events.push(mapper.event(event.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare events forsearch.', err)
            callback(err)
            return
        }
        // debug('Events prepared for searching.')
        callback()
    })
}


module.exports = router
