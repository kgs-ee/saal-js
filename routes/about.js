var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var prepped_news = {}

router.get('/', function(req, res, next) {
    debug('Loading "' + req.url + '"', req.params.lang)

    res.render('about', {
    	"news": prepped_news
    })
    res.end()
})

router.prepare = function prepare(callback) {
    debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareNews)
    async.parallel(parallelf, function(err) {
        debug('Prepared ' + path.basename(__filename).replace('.js', ''))
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
        debug('News prepared.', prepped_news)
        callback()
    })
}

module.exports = router
