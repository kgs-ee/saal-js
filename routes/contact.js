var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var prepped_users = []

router.get('/', function(req, res, next) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    res.render('contact', {
    	"users": prepped_users
    })
    res.end()
})

// Users
function prepareUsers(callback) {
    prepped_users = []
    async.each(SDC.get(['local_entities', 'by_definition', 'person'], []), function(entity, callback) {
        prepped_users.push(mapper.user(entity.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare users.', err)
            callback(err)
            return
        }
        // debug('Users prepared.')
        callback()
    })
}

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareUsers)
    async.parallel(parallelf, function(err) {
        if (err) { return callback(err) }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

module.exports = router
