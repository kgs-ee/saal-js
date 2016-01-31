var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var mapper  = require('../helpers/mapper')


var featured = []
var programUpcoming = {}
var toursUpcoming = {}
var residencyPast = {}
var sideBanner

var cachedPage


router.get('/', function(req, res) {
    debug('Loading "' + path.basename(__filename).replace('.js', '') + '" ' + req.path)
    if (cachedPage) {
        debug('Found cache')
        res.write(cachedPage)
        res.end()
    } else {
        debug('Prerendering "' + path.basename(__filename).replace('.js', '') + '" ' + req.path)
        var translate = require(require.resolve('../helpers/i18n')).translate
        var locales = require(require.resolve('../helpers/i18n')).locales
        var lang = require(require.resolve('../helpers/i18n')).lang
        // res.locals.t = require(require.resolve('../helpers/i18n')).translate
        var templatePath = require.resolve('../views/index.jade')
        var templateFn = require('jade').compileFile(templatePath)
        cachedPage = templateFn ({
            t: translate,
            locales: locales,
            lang: lang,
            op: op,
            SAAL: SDC.get('root'),
            moment: require('moment'),
            'featured': featured,
            'program': programUpcoming,
            'tours': toursUpcoming,
            'residencies': residencyPast,
            'sideBanner': sideBanner
        })
        debug('Done cacheing')
        res.write(cachedPage)
        res.end()
    }
    debug('Rendered "' + path.basename(__filename).replace('.js', '') + '" ' + req.path)
    // res.end()
})


// Side Banner
function prepareSideBanner(callback) {
    var bannerEid = SDC.get(['relationships', '3806', 'banner', 0], false)
    if (bannerEid) {
        sideBanner = mapper.banner(bannerEid)
    }
    // debug('Side banners prepared.')
    callback()
}

// Featured performamces
function prepareFeatured(callback) {
    featured = []
    async.each(SDC.get(['local_entities', 'featured']), function(entity, callback) {
        featured.push(mapper.performance(entity.id))
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare featured performances.', err)
            callback(err)
            return
        }
        // debug('Featured performances prepared.')
        callback()
    })
}

// Upcoming events
function prepareUpcomingEvents(callback) {
    programUpcoming = {}
    async.each(SDC.get(['local_entities', 'by_class', 'program']), function(entity, callback) {
        var event = mapper.event(entity.id)
        if (event['start-time']) {
            if (new Date() > new Date(event['start-time'])) {
                return callback()
            }
            // debug(new Date().toJSON(), event['start-time'], new Date(event['start-time']).toJSON())
            var eventDate = (event['start-time']).slice(0,10)
            var eventTime = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', eventDate)
            op.set(event, 'event-time', eventTime)
            op.push(programUpcoming, [eventDate, eventTime], event)
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare upcoming events.', err)
            callback(err)
            return
        }
        // debug('Upcoming events prepared.')
        callback()
    })
}

// Upcoming tours
function prepareUpcomingTours(callback) {
    toursUpcoming = {}
    async.each(SDC.get(['local_entities', 'by_class', 'tour']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // debug(JSON.stringify(event, null, 2))
        if (event['start-time']) {
            var eventDate = (event['start-time']).slice(0,10)
            var eventTime = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', eventDate)
            op.set(event, 'event-time', eventTime)
            op.push(toursUpcoming, [eventDate, eventTime], event)
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare upcoming tours.', err)
            callback(err)
            return
        }
        // debug('Upcoming tours prepared.')
        callback()
    })
}

// Past residency
function preparePastResidency(callback) {
    residencyPast = {}
    async.each(SDC.get(['local_entities', 'by_class', 'residency']), function(entity, callback) {
        var event = mapper.event(entity.id)
        // console.log(JSON.stringify(event, null, 2))
        if (event['start-time']) {
            var eventDate = (event['start-time']).slice(0,10)
            var eventTime = (event['start-time']).slice(11,16)
            op.set(event, 'event-date', eventDate)
            op.set(event, 'event-time', eventTime)
            op.push(residencyPast, [eventDate, eventTime], event)
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to prepare past residency.', err)
            callback(err)
            return
        }
        // debug('Past residency prepared.')
        callback()
    })
}

// Past residency
function clearCachedRender(callback) {
    debug('Clearing cached render from ' + path.basename(__filename).replace('.js', ''))
    cachedPage = undefined
}


router.prepare = function prepare(callback) {
    // debug('Preparing ' + path.basename(__filename).replace('.js', ''))
    var parallelf = []
    parallelf.push(prepareFeatured)
    parallelf.push(prepareUpcomingEvents)
    parallelf.push(prepareUpcomingTours)
    parallelf.push(preparePastResidency)
    parallelf.push(prepareSideBanner)
    parallelf.push(clearCachedRender)
    async.parallel(parallelf, function(err) {
        if (err) { return callback(err) }
        // debug('Prepared ' + path.basename(__filename).replace('.js', ''))
        callback()
    })
}

module.exports = router
