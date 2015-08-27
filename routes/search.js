var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var sift    = require('sift')


router.get('/', function(req, res, next) {
    debug('Looking for "' + req.query.q + '"')
    // debug(JSON.stringify(SDC.get('events'), null, '  '))
    res.locals.q = req.query.q

    var re = new RegExp('(?=.*' + req.query.q.replace(/\s\s+/g, ' ').split(' ').join(')(?=.*') + ')','i')
    debug('Search regExp: ' + re.toString())

    // fs.createWriteStream('./pagecache/all_events.json').write(JSON.stringify(ALL_EVENTS, null, '  '))
    // fs.createWriteStream('./pagecache/event_lookup.json').write(JSON.stringify(EVENT_LOOKUP, null, '  '))

    var results = sift({ name: re }, ALL_EVENTS)

    // debug(JSON.stringify(SDC.get('events'), null, '  '))
    debug(JSON.stringify(results, null, '  '))

    res.render('search', {
        results: results
    })
    res.end()
})


module.exports = router
