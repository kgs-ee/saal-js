var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {
    // debug('Loading "' + req.url + '" with ' + op.get(req, 'query.date', 'no date'))
    res.setHeader('Content-Type', 'application/json');
    var date = op.get(req, 'query.date')
    if (date) {
        // debug('Looking for "' + date + '"')
        res.send(require(path.join(APP_CACHE_DIR, 'calendar.json'))[date])
    } else {
        res.send(require(path.join(APP_CACHE_DIR, 'calendar.json')))
    }
    res.end()
})


module.exports = router
