var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var prepped_news = {}
var prepped_locations = []

router.get('/', function(req, res, next) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    res.render('about', {
    	"news": prepped_news,
    	"locations": prepped_locations,
    })
    res.end()
    // debug(JSON.stringify(prepped_locations, null, 4))
})

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareNews)
    parallelf.push(prepareLocations)
    async.parallel(parallelf, function(err) {
        if (err) {
            debug('Failed to prepare ' + path.basename(__filename).replace('.js', ''), err)
            callback(err)
            return
        }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

// News
var prepareNews = function prepareNews(callback) {
    prepped_news = {}
    async.each(SDC.get(['local_entities', 'by_class', 'news']), function(entity, callback) {
        var news = mapper.news(entity.id)
        if (!news.time) {
            callback()
            return
        }
        // debug(JSON.stringify(news, null, 2))
        var news_date = news.time.slice(0,10)
        // var news_time = news.time.slice(11,16)
        op.push(prepped_news, news_date, news)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare news.', err)
            callback(err)
            return
        }
        // debug('News prepared.')
        callback()
    })
}

// Locations
var prepareLocations = function prepareLocations(callback) {
    prepped_locations = []
    async.each(SDC.get(['local_entities', 'by_class', 'location']), function(entity, callback) {
        var location = mapper.location(entity.id)
        if (!location.floorplan) {
            callback()
            return
        }
        prepped_locations.push(location)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare locations.', err)
            callback(err)
            return
        }
        // debug('Locations prepared.')
        callback()
    })
}

module.exports = router
