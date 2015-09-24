var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')


router.get('/:id', function(req, res, next) {

    var event = ALL_EVENTS[EVENT_LOOKUP[req.path.split('/')[1]]]

    res.render('resident', {
        "event": event
    })
    res.end()
    return
})


module.exports = router
