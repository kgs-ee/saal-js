var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var prepped_news = {}
var prepped_locations = []
var prepped_supporters = {}

router.get('/', function(req, res) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '"')

    res.render('about', {
    	"news"       : prepped_news,
    	"locations"  : prepped_locations,
    	"supporters" : prepped_supporters,
    })
    res.end()
    // debug(JSON.stringify(prepped_locations, null, 4))
})

router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareNews)
    parallelf.push(prepareLocations)
    parallelf.push(prepareSupporters)
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
function prepareNews(callback) {
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
function prepareLocations(callback) {
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

// Supporters
function prepareSupporters(callback) {
    var BANNER_SIZES = {
        2788: "big",
        2787: "small"
    }
    prepped_supporters = {}
    async.each(SDC.get(['local_entities', 'by_class', 'supporters']), function(entity, callback) {
        var supporter = mapper.banner(entity.id)
        var banner_size = op.get(BANNER_SIZES, op.get(supporter, ['type', 'id']), false)
        if (!banner_size) {
            return callback()
        }
        if (!op.get(prepped_supporters, banner_size, false)) {
            op.set(prepped_supporters, banner_size, JSON.parse(JSON.stringify(op.get(supporter, ['type']))))
        }
        op.push(prepped_supporters, [banner_size, 'banners'], supporter)
        // prepped_supporters.push(supporter)
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare supporters.', err)
            callback(err)
            return
        }
        // debug('Supporters prepared.', JSON.stringify(prepped_supporters, 6, 4))
        callback()
    })
}

module.exports = router
