var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')

var entu    = require('./entu')



// GET requests/offers listing
router.get('/:type', function(req, res, next) {
    if(req.params.type === 'requests') {
        var page_id = 654
        var help_group = 650
        var help_type = 'request'
    } else if(req.params.type === 'offers') {
        var page_id = 655
        var help_group = 651
        var help_type = 'offer'
    } else {
        res.redirect('/help/requests')
        return
    }

    entu.get_entities(help_group, 'request', null, null, function(error, requests) {
        if(error) return next(error)

        res.render('help', {
            requests: requests,
            show_add: (req.signedCookies.auth_id && req.signedCookies.auth_token),
            help_type: help_type
        })
    })
})



// Create request/offer
router.post('/:type', function(req, res, next) {
    if(!req.signedCookies.auth_id || !req.signedCookies.auth_token) {
        res.status(403).send()
        return
    }

    if(req.params.type === 'requests') {
        var page_id = 654
        var help_group = 650
        var help_type = 'request'
    } else if(req.params.type === 'offers') {
        var page_id = 655
        var help_group = 651
        var help_type = 'offer'
    } else {
        res.status(403).send()
        return
    }

    var properties = req.body
    properties['person'] = req.signedCookies.auth_id

    entu.add(help_group, 'request', properties, req.signedCookies.auth_id, req.signedCookies.auth_token, function(error, new_id) {
        if(error) return next(error)

        entu.make_public(new_id, req.signedCookies.auth_id, req.signedCookies.auth_token, function(error, response) {
            if(error) return next(error)

            res.status(200).send(response)
        })

    })
})



module.exports = router
