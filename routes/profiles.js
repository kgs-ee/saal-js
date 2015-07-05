var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request = require('request')
var md      = require('marked')



// GET profiles listing
router.get('/', function(req, res, next) {
    request.get({url: APP_ENTU_URL + '/entity', qs: {definition: 'person'}, strictSSL: true, json: true}, function(error, response, body) {
        if(error) throw error
        if(response.statusCode !== 200 || !body.result) throw new Error(body)

        res.render('profiles', {
            title: 'Profiles',
            profiles: body.result
        })
    })
})



// GET profile
router.get('/:id', function(req, res, next) {
    if(!req.params.id) res.redirect('/profiles')

    request.get({url: APP_ENTU_URL + '/entity-' + req.params.id, strictSSL: true, json: true}, function(error, response, body) {
        if(error) throw error
        if(response.statusCode !== 200 || !body.result) throw new Error(body)

        var properties = body.result.properties
        var profile = {
            forename: '',
            surname: '',
            about: {
                text: '',
                photo: '',
                video: ''
            },
            i_help: {
                text: '',
                photo: '',
                video: ''
            },
            you_help: {
                text: '',
                photo: '',
                video: ''
            },

        }

        if(properties['forename'].values) profile.forename = properties['forename'].values[0].db_value
        if(properties['surname'].values) profile.surname = properties['surname'].values[0].db_value
        if(properties['slogan'].values) profile.slogan = properties['slogan'].values[0].db_value
        if(properties['photo'].values) profile.photo = APP_ENTU_URL + '/file-' + properties['photo'].values[0].db_value

        if(properties['about-me-text'].values) profile.about.text = properties['about-me-text'].values[0].db_value
        if(properties['about-me-photo'].values) profile.about.photo = properties['about-me-photo'].values[0].db_value
        if(properties['about-me-video'].values) profile.about.video = properties['about-me-video'].values[0].db_value

        if(properties['me-help-you-text'].values) profile.i_help.text = properties['me-help-you-text'].values[0].db_value
        if(properties['me-help-you-photo'].values) profile.i_help.photo = properties['me-help-you-photo'].values[0].db_value
        if(properties['me-help-you-video'].values) profile.i_help.video = properties['me-help-you-video'].values[0].db_value

        if(properties['you-help-me-text'].values) profile.you_help.text = properties['you-help-me-text'].values[0].db_value
        if(properties['you-help-me-photo'].values) profile.you_help.photo = properties['you-help-me-photo'].values[0].db_value
        if(properties['you-help-me-video'].values) profile.you_help.video = properties['you-help-me-video'].values[0].db_value

        res.render('profile', {
            pretitle: 'Meet with',
            title: profile.forename + ' ' + profile.surname,
            profile: profile,
            md: md
        })
    })
})



module.exports = router
