var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')


router.get('/', function(req, res, next) {
    res.render('projects', {
        projects: projects
    })
    res.end()
})

var projects = []

router.prepare = function prepare(callback) {
    projects = []
    async.each(SDC.get(['local_entities', 'by_class', 'project']), function(entity, callback) {
        var event = mapper.event(entity.id)
        projects.push(event)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare projects.', err)
            callback(err)
            return
        }
        callback()
         debug('Projects prepared - ', JSON.stringify(projects, null, 4))
    })
}

module.exports = router
