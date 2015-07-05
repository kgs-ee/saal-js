var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))



// GET home page
router.get('/', function(req, res, next) {
    res.render('index')
})



module.exports = router
