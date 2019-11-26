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
var allEvents = [] // = SDC.get(['local_entities', 'by_definition', 'performance'])


router.get('/', function(req, res, next) {

    var results = {}
    var query = req.query.q
    res.locals.q = query

    if (!query) {
        return next()
    }

    var fuseOptions = {}

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
    }
    else if (query.split(':')[0] === 'category') {
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
    }
    else if (query.split(':')[0] === 'person') {
        var person = query.split(':')
        person.shift()
        person = person.join(':')
        debug('Looking for person "' + person + '"')
        fuseOptions = {
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
            , 'fuse_js': new fuse(require(path.join(APP_CACHE_DIR, 'users_all.json')), fuseOptions).search(person)
        }
        debug(JSON.stringify(results, null, '  '))
        res.render('search', {
            results: results
        })
        res.end()
    }
    else if (query.split(':')[0] === 'giphy') {
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
    }
    else if (query) {
        query = query.toLowerCase()
        var lang = res.locals.lang
        var keys4event = [
            [lang + '-name'],
            [lang + '-subtitle'],
            [lang + '-description'],
            [lang + '-technical-information'],
            ['performance', 'artist'],
            ['performance', 'producer'],
            ['performance', lang + '-name'],
            ['performance', lang + '-subtitle'],
            ['performance', lang + '-supertitle'],
            ['performance', lang + '-description'],
            ['performance', lang + '-technical-information'],
        ]
        var keys4performance = [
            ['artist'],
            ['producer'],
            [lang + '-name'],
            [lang + '-subtitle'],
            [lang + '-supertitle'],
            [lang + '-description'],
            [lang + '-technical-information'],
        ]

        var filteredPerformances = allPerformances.filter(function(performance) {
            return keys4performance.some(function(key) {
                return op.get(performance, key, '').toLowerCase().indexOf(query) !== -1
            })
        })

        var filteredEvents = allEvents.filter(function(event) {
            return keys4event.some(function(key) {
                if (op.get(event, key, '').toLowerCase().indexOf(query) === -1) { return false }
                return filteredPerformances.map(function(a){ return Number(a.id) }).indexOf(op.get(event, ['performance', 'id'])) === -1
            })
        })

        // keep only unique performances
        // var uniquePerformances = filteredPerformances.filter(function(performance, ix, arr) {
        //     return arr.indexOf(e) === i
        // })

        results = {
            'query_type': 'query'
            , 'query': req.query.q
            , 'performances': filteredPerformances
            , 'events': filteredEvents
            , 'count': filteredEvents.length + filteredPerformances.length
        }
        res.render('search', {
            results: results
        })
        res.end()

        // async.filter(allEvents, function iterator(event, iteratorCB) {
        //     var returnValue = false
        //     var length = keys.length
        //     for (var i = 0; i < length; i++) {
        //         if (op.get(event, keys[i], false) === false) {
        //             // debug( event.id + ' doesnot have ' + keys[i])
        //             continue
        //         }
        //         // debug( event.id + ' has ' + keys[i] + '. search for ' + query)
        //         var foundAt = op.get(event, keys[i]).toLowerCase().search(query)
        //         if (foundAt === -1) {
        //             debug( 'Cant find ' + query + ' in ' + op.get(event, keys[i]).toLowerCase())
        //             continue
        //         }
        //         // debug( 'Found ' + query + ' in ' + op.get(event, keys[i]).toLowerCase())
        //         op.set(event, keys[i], op.get(event, keys[i]).replace(re, highlight))
        //         returnValue = true
        //     }
        //     return iteratorCB(returnValue)
        // }, function filtered(filteredEvents) {
        //     // debug(JSON.stringify(filteredEvents, null, 4))
        //
        //     // keep only unique events
        //     // filteredEvents = filteredEvents.filter(function(e, i, arr) {
        //     //     return arr.indexOf(e) === i
        //     // })
        //     results = {
        //         'query_type': 'query'
        //         , 'query': req.query.q
        //         , 'events': filteredEvents
        //     }
        //     res.render('search', {
        //         results: results
        //     })
        //     res.end()
        // })
    }
    else {
        return next()
    }
})


router.prepare = function prepare(callback) {
    debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    callback()

    async.each(SDC.get(['local_entities', 'by_definition', 'performance']), function(performance, callback) {
        allPerformances.push(mapper.performance(performance.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare performances for search.', err)
            callback(err)
            return
        }
    })
    async.each(SDC.get(['local_entities', 'by_definition', 'event']), function(event, callback) {
        allEvents.push(mapper.event(event.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare events for search.', err)
            callback(err)
            return
        }
    })
}


module.exports = router
