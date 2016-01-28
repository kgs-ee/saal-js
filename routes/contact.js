var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
// var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var preppedUsers = []

router.get('/', function(req, res) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    res.render('contact', {
    	'users': preppedUsers
    })
    res.end()
})

router.prepare = function prepare(callback) {
    preppedUsers = []
    async.each(SDC.get(['local_entities', 'by_definition', 'person'], []), function(entity, callback) {
        preppedUsers.push(mapper.user(entity.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare users.', err)
            return callback(err)
        }
        preppedUsers.sort(function(a,b) { return a.ordinal - b.ordinal })
        callback()
    })
}

module.exports = router
