var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


router.get('/', function(req, res, next) {
    res.render('saal-biennaal', {
    })
    res.end()
})

module.exports = router
