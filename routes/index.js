var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {

    if (!SDC.get('program_upcoming')) {
        debug(res.locals.t('error.cache_missing_upcoming_events'))
    }
    if (!SDC.get('tours_upcoming')) {
        debug(res.locals.t('error.cache_missing_upcoming_tours'))
    }
    if (!SDC.get('residency_past')) {
        debug(res.locals.t('error.cache_missing_residency_past'))
    }

    res.render('index', {
        "program": SDC.get('program_upcoming'),
        "tours": SDC.get('tours_upcoming'),
        "residencies": SDC.get('residency_past'),
        path: req.path
    })
    res.end()
    return
})


module.exports = router
