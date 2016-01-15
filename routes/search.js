var express = require('express')
var request = require('request')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var fuse    = require('fuse.js')                // http://kiro.me/exp/fuse.html

var mapper  = require('../helpers/mapper')

var allPerformances = [] // = SDC.get(['local_entities', 'by_definition', 'performance'])


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
        // var performances = []
        var qCategory = query.split(':')
        qCategory.shift()
        qCategory = qCategory.join(':').toLowerCase()
        qCategory = qCategory.split(',')
        var queryCategory = qCategory.map(function(eId) {
            return op.get(mapper.category(eId), [res.locals.lang + '-name'])
        })
        debug('Looking for category "' + queryCategory + '"')
        results = {
            'query_type': 'category',
            'query_category': queryCategory,
            'performances': [],
            'events': []
        }
        async.each(qCategory, function(catEid, CB1) {
            async.each(SDC.get(['relationships', catEid, 'event']), function(eventEid, CB2) {
                op.push(results, ['events'], mapper.event(eventEid))
                debug('Add event', eventEid)
                CB2()
            }, function(err) {
                if (err) { return CB1(err) }
                async.each(SDC.get(['relationships', catEid, 'performance']), function(performanceEid, CB3) {
                    op.push(results, ['performances'], mapper.event(performanceEid))
                    CB3()
                }, function(err) {
                    if (err) { return CB1(err) }
                    CB1()
                })
            })
        }, function(err) {
            if (err) {
                debug('Failed to search by category.', err)
                return callback(err)
            }
            res.render('search', { results: results })
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
            , 'fuse_js': new fuse(allPerformances, fuse_options).search(req.query.q)
            // , 'fuzzy': fuzzy.filter(req.query.q, allPerformances, fuzzy_options)
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
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    async.each(SDC.get(['local_entities', 'by_definition', 'performance']), function(performance, callback) {
        allPerformances.push(mapper.performance(performance.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare performances forsearch.', err)
            callback(err)
            return
        }
        callback()
    })
}


module.exports = router
