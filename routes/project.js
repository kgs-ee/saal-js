var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


router.get('/:id', function(req, res, next) {

    var event_eid = req.path.split('/')[1]
    var event = mapper.event(event_eid)

    res.render('resident', {
        "event": event,
        "id": event.id
    })
    res.end()
    return
})

module.exports = router