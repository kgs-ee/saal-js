var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
// var op      = require('object-path')
var mapper  = require('../helpers/mapper')


var projects = []

router.get('/', function(req, res) {
    res.render('projects', {
        projects: projects
    })
    res.end()
})

router.prepare = function prepare(callback) {
    projects = []
    async.each(SDC.get(['local_entities', 'by_class', 'project']), function(entity, callback) {
        var event = mapper.event(entity.id)
        projects.push(event)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare projects.', err)
            return callback(err)
        }
        projects.sort(function(a,b) { return a.ordinal - b.ordinal })
        callback()
    })
}

module.exports = router
