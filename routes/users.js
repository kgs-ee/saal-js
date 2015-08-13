var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')

var entu    = require('./entu')


// GET profiles listing
router.get('/', function(req, res, next) {
    res.end('user_list')
})



// Show user own profile
router.get('/me', function(req, res, next) {
    if(!req.signedCookies.auth_id || !req.signedCookies.auth_token) {
        res.redirect('/signin')
        next(null)
    }

    entu.get_entity(req.signedCookies.auth_id, req.signedCookies.auth_id, req.signedCookies.auth_token, function(error, profile) {
        if(error) return next(error)

        res.render('my_profile_edit', {
            profile: profile
        })
    })
})



// Edit user profile
router.post('/me', function(req, res, next) {
    if(!req.signedCookies.auth_id || !req.signedCookies.auth_token) {
        res.status(403).send()
        return
    }

    entu.set_user(req.signedCookies.auth_id, req.signedCookies.auth_token, req.body, function(error, response) {
        if(error) return next(error)

        res.status(200).send(response)
    })
})



// GET profile
router.get('/:id', function(req, res, next) {
    debug('/:id', req.params)
    res.end('user_list')
})



module.exports = router
