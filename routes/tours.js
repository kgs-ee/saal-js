var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


router.get('/', function(req, res, next) {

    var tours = []
    var tours = SDC.get('tours_upcoming')
    if (!tours) {
        next(new Error('"tours_upcoming" not cached...'))
    }

    res.render('tours', {
        "tours": tours
    })
    res.end()
})


module.exports = router
