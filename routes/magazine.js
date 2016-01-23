var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')


function renderEcho(res, echoId) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    var echoA = {}
    var minDate = false
    var maxDate = new Date()
    async.each(SDC.get(['local_entities', 'by_class', 'echo']), function(entity, callback) {
        var echo = mapper.echo(entity.id)
        if (!echo['date']) { return callback() }

        if (new Date(echo['date']) > maxDate) { maxDate = new Date(echo['date']) }
        if (minDate === false) { minDate = new Date(echo['date']) }
        if (new Date(echo['date']) < minDate) { minDate = new Date(echo['date']) }

        op.push(echoA, [echo.year, echo.month, echo.day], echo)
        callback()
    }, function(err) {
        if (err) {
            console.log('Failed to render echo.', err)
            return
        }

        res.render('echo', {
            'echo': (echoId ? mapper.echo(echoId) : null),
            'echoArray': echoA,
            'minDate': minDate,
            'maxDate': maxDate
        })
        res.end()
    })
}

router
    .get('/', function(req, res) {
        renderEcho(res)
        res.end()
    })
    .get('/:id', function(req, res) {
        debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderEcho(res, req.params.id)
    })


module.exports = router
