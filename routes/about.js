var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var preppedNews = {}
var preppedLocations = []
var preppedSupporters = {}

router.get('/', function(req, res) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')
    //debug(op.get(SDC.get(['root', 'gallery'], []))

    res.render('about', {
    	'news'       : preppedNews,
    	'locations'  : preppedLocations,
    	'supporters' : preppedSupporters,
    })
    res.end()
    // debug(JSON.stringify(preppedLocations, null, 4))
})

// News
function prepareNews(callback) {
    var displayTopNewsCount = 5
    var newsEids = Object.keys(SDC.get(['local_entities', 'by_class', 'news'], {})).filter(function (eid) {
        if (SDC.get(['local_entities', 'by_eid', eid, 'properties', 'time', 'value'], false) === false) { return false }
        return true
    })
    newsEids.sort(function(a, b) {
        var aDate = new Date(SDC.get(['local_entities', 'by_eid', a, 'properties', 'time', 'value']))
        var bDate = new Date(SDC.get(['local_entities', 'by_eid', b, 'properties', 'time', 'value']))
        // debug(a, aDate, b, bDate, aDate < bDate)
        return (aDate < bDate)
    })
    preppedNews = {}
    async.each(newsEids.slice(0, displayTopNewsCount), function(eid, callback) {
        var news = mapper.news(eid)
        if (!news.time) { return callback() }
        // debug(JSON.stringify(news, null, 2))
        var newsDate = op.get(news, ['time']).slice(0,10)
        op.push(preppedNews, newsDate, news)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare news.', err)
            return callback(err)
        }
        callback()
    })
}

// Locations
function prepareLocations(callback) {
    preppedLocations = []
    async.each(SDC.get(['local_entities', 'by_class', 'location'], []), function(entity, callback) {
        var location = mapper.location(entity.id)
        if (!location.floorplan) { return callback() }
        preppedLocations.push(location)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare locations.', err)
            return callback(err)
        }
        // debug('Locations prepared.')
        callback()
    })
}

// Supporters
function prepareSupporters(callback) {
    var BANNER_SIZES = {
        2788: 'big',
        2787: 'small'
    }
    preppedSupporters = {}
    async.each(SDC.get(['local_entities', 'by_class', 'supporters'], []), function(entity, callback) {
        var supporter = mapper.banner(entity.id)
        // debug('supporter', JSON.stringify(supporter, null, 4))
        op.get(supporter, ['type'], []).forEach(function(type) {
            var bannerSize = op.get(BANNER_SIZES, type, false)
            if (!bannerSize) { return }
            op.push(preppedSupporters, [bannerSize, 'banners'], supporter)
        })
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare supporters.', err)
            return callback(err)
        }
        // debug('Supporters prepared.', JSON.stringify(preppedSupporters, null, 4))
        callback()
    })
}

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareNews)
    parallelf.push(prepareLocations)
    parallelf.push(prepareSupporters)
    async.parallel(parallelf, function(err) {
        if (err) {
            debug('Failed to prepare ' + path.basename(__filename).replace('.js', ''), err)
            return callback(err)
        }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}


module.exports = router
