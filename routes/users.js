var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')

var entu    = require('./entu')



// Convert media url to embeding url
function media_embed(url) {
    if(!url) return null

    if(url.indexOf('youtu.be/') > -1) {
        return 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1].split('?')[0]
    } else if (url.indexOf('youtube.com/watch') > -1) {
        return 'https://www.youtube.com/embed/' + url.split('v=')[1].split('&')[0]
    }else if (url.indexOf('vimeo.com/') > -1) {
        return 'https://player.vimeo.com/video/' + url.split('vimeo.com/')[1].split('?')[0]
    }else if (url.indexOf('wistia.com/medias/') > -1) {
        return 'https://fast.wistia.net/embed/iframe/' + url.split('wistia.com/medias/')[1].split('?')[0]
    }else {
        return null
    }
}



// GET profiles listing
router.get('/', function(req, res, next) {
    entu.get_entities(615, 'person', null, null, function(error, profiles) {
        if(error) return next(error)

        res.render('user_list', {
            profiles: profiles
        })
    })
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
    if(!req.params.id) res.redirect('/users')

        entu.get_entity(req.params.id, null, null, function(error, profile) {
            if(error) return next(error)

            res.render('user', {
                title: profile.get('forename.value', '') + ' ' + profile.get('surname.value', ''),
                profile: profile,
                media_embed: media_embed
            })
        })
})



module.exports = router
