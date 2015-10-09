var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')

var performances = []

router.get('/', function(req, res, next) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    res.render('co_productions', {
        "performances": performances
    })
    res.end()
})

router.prepare = function prepare(callback) {
    debug('Preparing "' + path.basename(__filename).replace('.js', '') + '"')
    performances = []
    async.each(SDC.get(['local_entities', 'by_definition', 'performance'], []), function(entity, callback) {
        if (op.get(entity, ['properties', 'coprod', 'value']) === "True") {
            performances.push(mapper.performance(entity.id))
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare "' + path.basename(__filename).replace('.js', '') + '".', err)
            callback(err)
            return
        }
        debug('"' + path.basename(__filename).replace('.js', '') + '" prepared.')
        // debug(JSON.stringify(performances, null, 4))
        callback()
    })
}

module.exports = router
