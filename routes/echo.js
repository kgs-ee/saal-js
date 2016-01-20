var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')
var mapper  = require('../helpers/mapper')
var helper  = require('../helpers/helper')


function renderEcho(res, id) {
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

        var echoYear = (echo['date']).slice(0,4)
        var echoMonth = (echo['date']).slice(5,7)
        var echoDay = (echo['date']).slice(8,10)
        op.set(echo, 'echoYear', echoYear)
        op.set(echo, 'echoMonth', echoMonth)
        op.set(echo, 'echoDay', echoDay)
        op.push(echoA, [echoYear, echoMonth, echoDay], echo)
        callback()
    }, function(err) {
        if (err) {
            console.log('Failed to render echo.', err)
            return
        }

        res.render('echo', {
            'echo': echoA,
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
    .get('/:date', function(req, res) {
        // debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
        renderEcho(res, req.params.date)
    })


module.exports = router
