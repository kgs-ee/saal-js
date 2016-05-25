var express = require('express')
var router = express.Router()
var path = require('path')
var debug = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async = require('async')
var op = require('object-path')
var mapper = require('../helpers/mapper')
// var helper  = require('../helpers/helper')

function renderEcho (res, currentEchoId) {
  debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

  var echoA = {}
  var echoFA = {}
  var echoLinkedA = {}
  var minDate = false
  var maxDate = false
  // var latestEchoId

  var echoCategories = Object.keys(SDC.get(['local_entities', 'by_class', 'echoCategory'], {}))
    .map(function (eId) {
      var mappedCategory = mapper.category(eId)
      eId = String(eId)
      mappedCategory.checked = false
      if (currentEchoId) {
        var echoCatIds = SDC.get(['relationships', currentEchoId, 'category'], [])
        // debug('current:', echoCatIds)
        if (echoCatIds.indexOf(eId) > -1) {
          mappedCategory.checked = true
        }
      }
      return mappedCategory
    })

  async.each(SDC.get(['local_entities', 'by_class', 'echo']), function (entity, callback) {
    var echo = mapper.echo(entity.id)
    if (!echo.date) { return callback() }

    if (maxDate === false || new Date(echo.date) > maxDate) {
      maxDate = new Date(echo.date)
      latestEchoId = echo.id
    }
    if (minDate === false || new Date(echo.date) < minDate) { minDate = new Date(echo.date) }

    if (echo.featured) {
      op.push(echoFA, [echo.year, echo.month, echo.day], echo)
    } else {
      op.push(echoA, [echo.year, echo.month, echo.day], echo)
    }

    if (currentEchoId && Number(currentEchoId) !== Number(echo.id)) {
      // debug(currentEchoId, '!==', echo.id)
      var echoCatIds = SDC.get(['relationships', currentEchoId, 'category'], [])
      // debug('check cats:', SDC.get(['relationships', echo.id, 'category'], []))
      if (SDC.get(['relationships', echo.id, 'category'], []).some(function (eId) {
        // debug(eId, echoCatIds)
        return echoCatIds.indexOf(eId) > -1
      })) {
        op.push(echoLinkedA, [echo.year, echo.month, echo.day], echo)
      }
    }

    callback()
  }, function (err) {
    if (err) {
      console.log('Failed to render echo.', err)
      return
    }

    if (currentEchoId) {
      // debug(JSON.stringify(echoLinkedA))
      res.render('magazine-article', {
        'allEchos': {'linked': echoLinkedA},
        'echo': mapper.echo(currentEchoId),
        'echoCategories': echoCategories,
        'minDate': minDate,
        'maxDate': maxDate,
        'title': op.get(mapper.echo(currentEchoId), res.locals.lang + '-title', '')
      })
    } else {
      res.render('magazine', {
        'allEchos': {'feature': echoFA, 'others': echoA},
        'minDate': minDate,
        'maxDate': maxDate
      })
    }
    res.end()
  })
}

router
  .get('/', function (req, res) {
    renderEcho(res)
    res.end()
  })
  .get('/:id', function (req, res) {
    debug('Requested "' + req.url + '"' + JSON.stringify(req.params, null, 2))
    renderEcho(res, req.params.id)
  })

module.exports = router
