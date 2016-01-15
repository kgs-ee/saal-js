var express = require('express')
var router  = express.Router()
// var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))

var mapper  = require('../helpers/mapper')


router.get('/:id', function(req, res) {

    var eventEid = req.path.split('/')[1]
    var event = mapper.event(eventEid)

    res.render('resident', {
        'event': event,
        'id': event.id
    })
    res.end()
    return
})

module.exports = router
