var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {
    debug('Loading "' + req.url + '"')

    // res.locals.lang = req.params.lang
    res.render('index', {
        "program": SDC.get('program_upcoming'),
        "tours": SDC.get('tours_upcoming')
    })
    res.end()
})


module.exports = router
