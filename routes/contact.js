var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


// router.get('/', function(req, res, next) {
//     debug('Loading "' + req.url + '"', req.params.lang)

//     // res.locals.lang = req.params.lang
//     res.render('contact', {
//         "users": SDC.get('users_others')
//     })
//     res.end()
// })


// module.exports = router

var mapper  = require('../helpers/mapper')


var prepped_users = {}

router.get('/', function(req, res, next) {
    debug('Loading "' + req.url + '"', req.params.lang)

    res.render('contact', {
    	"users": prepped_users
    })
    res.end()
})

router.prepare = function prepare(callback) {
    debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareUsers)
    async.parallel(parallelf, function(err) {
        debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

// Users
var prepareUsers = function prepareUsers(callback) {
    prepped_users = {}
    async.each(SDC.get(['local_entities', 'by_definition', 'person'], []), function(entity, callback) {
        var users = mapper.user(entity.id)
        // if (!users.time) {
        //     callback()
        //     return
        // }
        debug(JSON.stringify(users, null, 2))
        // var users_date = users.time.slice(0,10)
        // // var users_time = users.time.slice(11,16)
        // op.push(prepped_users, users_date, users)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare users.', err)
            callback(err)
            return
        }
        debug('Users prepared.')
        callback()
    })
}

module.exports = router
