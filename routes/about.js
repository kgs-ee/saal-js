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
    //debug(op.get(SDC.get(['root', 'gallery'], []))

    res.render('about', {
    	'news'       : prepped_news,
    	'locations'  : prepped_locations,
    	'supporters' : prepped_supporters,
    })
    res.end()
    // debug(JSON.stringify(prepped_locations, null, 4))
})

// News
function prepareNews(callback) {
    var display_top_news_count = 5
    var news_eids = Object.keys(SDC.get(['local_entities', 'by_class', 'news'], {})).filter(function (eid) {
        if (SDC.get(['local_entities', 'by_eid', eid, 'properties', 'time', 'value'], false) === false) { return false }
        return true
    })
    news_eids.sort(function(a, b) {
        var a_date = new Date(SDC.get(['local_entities', 'by_eid', a, 'properties', 'time', 'value']))
        var b_date = new Date(SDC.get(['local_entities', 'by_eid', b, 'properties', 'time', 'value']))
        // debug(a, a_date, b, b_date, a_date < b_date)
        return (a_date < b_date)
    })
    prepped_news = {}
    async.each(news_eids.slice(0, display_top_news_count), function(eid, callback) {
        var news = mapper.news(eid)
        if (!news.time) { return callback() }
        // debug(JSON.stringify(news, null, 2))
        var news_date = op.get(news, ['time']).slice(0,10)
        // var news_time = news.time.slice(11,16)
        op.push(prepped_news, news_date, news)
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
    prepped_locations = []
    async.each(SDC.get(['local_entities', 'by_class', 'location'], []), function(entity, callback) {
        var location = mapper.location(entity.id)
        if (!location.floorplan) { return callback() }
        prepped_locations.push(location)
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
    prepped_supporters = {}
    async.each(SDC.get(['local_entities', 'by_class', 'supporters'], []), function(entity, callback) {
        var supporter = mapper.banner(entity.id)
        // debug('supporter', JSON.stringify(supporter, null, 4))
        op.get(supporter, ['type'], []).forEach(function(type) {
            var banner_size = op.get(BANNER_SIZES, type, false)
            if (!banner_size) { return }
            op.push(prepped_supporters, [banner_size, 'banners'], supporter)
        })
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare supporters.', err)
            return callback(err)
        }
        // debug('Supporters prepared.', JSON.stringify(prepped_supporters, null, 4))
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
