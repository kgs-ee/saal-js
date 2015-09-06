var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {

    if (!SDC.get('program_upcoming')) {next(new Error('cache_missing_upcoming_events'))}
    if (!SDC.get('tours_upcoming')) {next(new Error('cache_missing_upcoming_tours'))}

    res.render('index', {
        "program": SDC.get('program_upcoming'),
        "tours": SDC.get('tours_upcoming'),
        path: req.path
    })
    res.end()
    return
})


module.exports = router
