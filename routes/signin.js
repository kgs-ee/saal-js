var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')

var entu    = require('./entu')



// Show signin page
router.get('/', function(req, res, next) {
    res.render('signin')
})



// Get user session
router.get('/done', function(req, res, next) {
    if(!req.signedCookies.auth_url || !req.signedCookies.auth_state) {
        res.redirect('/signin')
        next(null)
    }

    entu.get_user_session(req.signedCookies.auth_url, req.signedCookies.auth_state, function(error, user) {
        if(error) return next(error)

        res.clearCookie('auth_url')
        res.clearCookie('auth_state')
        res.cookie('auth_id', user.id, {signed:true, maxAge:1000*60*60*24*14})
        res.cookie('auth_token', user.token, {signed:true, maxAge:1000*60*60*24*14})

        res.redirect('/users/me')
    })
})



// Sign out
router.get('/exit', function(req, res, next) {
    res.clearCookie('auth_url')
    res.clearCookie('auth_state')
    res.clearCookie('auth_id')
    res.clearCookie('auth_token')

    res.redirect('/')
})



// Sign in with given provider
router.get('/:provider', function(req, res, next) {
    if(!req.params.provider) res.redirect('/signin')

    res.clearCookie('auth_url')
    res.clearCookie('auth_state')
    res.clearCookie('auth_id')
    res.clearCookie('auth_token')

    entu.get_signin_url(req.protocol + '://' + req.hostname + '/signin/done',  req.params.provider, function(error, data) {
        if(error) return next(error)

        res.cookie('auth_url', data.auth_url, {signed:true, maxAge:1000*60*10})
        res.cookie('auth_state', data.state, {signed:true, maxAge:1000*60*10})
        res.redirect(data.auth_url + '/' + req.params.provider)
    })
})



module.exports = router
