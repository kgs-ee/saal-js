var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')


var getByParent = function getByParent(parent, definition, callback) {
    var childs = SDC.get(['relationships', parent, 'child'])
    var lookup = definition ? SDC.get(['local_entities', 'by_definition', definition]) : SDC.get(['local_entities', 'by_eid'])
    async.filter(lookup, function filter(one_entity) {
        debug(one_entity.id + ':', childs.indexOf(String(one_entity.id)) > -1)
        return childs.indexOf(String(one_entity.id)) > -1
    }, function filtered(entities) {
        debug('foo', entities)
        callback(null, entities)
    })
}
var getByDefinition = function getByDefinition(definition, callback) {
    callback(null, SDC.get('local_entities', ['by_definition', definition]))
}
var coverageByEventSync = function coverageByEventSync(event_eid) {
    return coverageByPerformanceSync(SDC.get(['local_entities', 'by_eid', event_eid, 'properties', 'performance', 'id']))
}
var coverageByPerformanceSync = function coverageByPerformanceSync(performance_eid) {
    var coverages = SDC.get(['relationships', performance_eid, 'coverage'], []).map(function(eid) {
        return mapCoverage(eid)
    })
    SDC.get(['relationships', performance_eid, 'event'], []).forEach(function(event_eid) {
        coverages = coverages.concat(
            SDC.get(['relationships', event_eid, 'coverage'], []).map(function(eid) {
                return mapCoverage(eid)
            })
        )
    })
    return coverages
}

var mapEvent = function event(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', eid)
    entity_out.set('pl-id', op_entity.get('properties.pl-id.value'))

    var categories = []
    op_entity.get('properties.category', []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entity_out.set('category', categories.filter(function(category) {if (category) return 1}))

    entity_out.set('color', op_entity.get('properties.color.value', '').split('; '))
    entity_out.set('tag', op_entity.get('properties.tag.value', '').split('; '))
    entity_out.set('en-name', op_entity.get('properties.en-name.value'))
    entity_out.set('et-name', op_entity.get('properties.et-name.value'))
    entity_out.set('en-description', op_entity.get('properties.en-description.md'))
    entity_out.set('et-description', op_entity.get('properties.et-description.md'))
    entity_out.set('photo', op_entity.get('properties.photo.0'))
    entity_out.set('photos', op_entity.get('properties.photo'))
    entity_out.set('video', op_entity.get('properties.video.value'))
    if (location_id = op_entity.get('properties.location.reference')) {
        entity_out.set('location', mapLocation(location_id))
    }
    entity_out.set('price', op_entity.get('properties.price.value'))
    entity_out.set('min-price', op_entity.get('properties.min-price.value'))
    entity_out.set('max-price', op_entity.get('properties.max-price.value'))
    entity_out.set('ticket-api', op_entity.get('properties.ticket-api.value'))
    entity_out.set('sales-status', op_entity.get('properties.sales-status.value'))
    entity_out.set('en-technical-information', op_entity.get('properties.en-technical-information.md'))
    entity_out.set('et-technical-information', op_entity.get('properties.et-technical-information.md'))

    entity_out.set('start-time', [])
    op_entity.get('properties.start-time', []).forEach(function stiterator(start_time) {
        entity_out.push('start-time', start_time.value)
    })

    if (performance_id = op_entity.get('properties.performance.reference')) {
        entity_out.set('performance', mapPerformance(performance_id))
        // debug('1: ' + JSON.stringify(entity_out.get('et-name'), null, 2))
        // debug('2: ' + JSON.stringify(entity_out.get(['performance', 'et-name']), null, 2))
        if (entity_out.get('en-name') === undefined) {
            entity_out.set('en-name', entity_out.get(['performance', 'en-name']))
        }
        if (entity_out.get('et-name') === undefined) {
            entity_out.set('et-name', entity_out.get(['performance', 'et-name']))
        }
        if (entity_out.get('en-description') === undefined) {
            entity_out.set('en-description', entity_out.get(['performance', 'en-description']))
        }
        if (entity_out.get('et-description') === undefined) {
            entity_out.set('et-description', entity_out.get(['performance', 'et-description']))
        }
        if (entity_out.get('en-subtitle') === undefined) {
            entity_out.set('en-subtitle', entity_out.get(['performance', 'en-subtitle']))
        }
        if (entity_out.get('et-subtitle') === undefined) {
            entity_out.set('et-subtitle', entity_out.get(['performance', 'et-subtitle']))
        }
        // debug('3: ' + JSON.stringify(entity_out.get('et-name'), null, 2))
    }

    // debug(entity_out.get())
    return entity_out.get()
}

var mapPerformance = function mapPerformance(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))

    var categories = []
    op_entity.get('properties.category', []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entity_out.set('category', categories.filter(function(category) {if (category) return 1}))

    entity_out.set('pl-id', op_entity.get('properties.pl-id.value'))
    entity_out.set('en-name', op_entity.get('properties.en-name.value'))
    entity_out.set('et-name', op_entity.get('properties.et-name.value'))
    entity_out.set('en-subtitle', op_entity.get('properties.en-subtitle.value'))
    entity_out.set('et-subtitle', op_entity.get('properties.et-subtitle.value'))
    entity_out.set('en-description', op_entity.get('properties.en-description.md'))
    entity_out.set('et-description', op_entity.get('properties.et-description.md'))
    entity_out.set('artist', op_entity.get('properties.artist.value'))
    entity_out.set('producer', op_entity.get('properties.producer.value'))
    entity_out.set('town', op_entity.get('properties.town.value'))
    entity_out.set('photo', op_entity.get('properties.photo.0'))
    entity_out.set('photos', op_entity.get('properties.photo'))
    entity_out.set('audio', op_entity.get('properties.audio.value'))
    entity_out.set('video', op_entity.get('properties.video.value'))
    entity_out.set('featured', op_entity.get('properties.featured.value') === "True")
    entity_out.set('et-technical-information', op_entity.get('properties.et-technical-information.md'))
    entity_out.set('en-technical-information', op_entity.get('properties.en-technical-information.md'))
    entity_out.set('premiere.start-time', op_entity.get('properties.premiere-time.value'))
    return entity_out.get()
}

var mapCoverage = function mapCoverage(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))
    entity_out.set('title', op_entity.get('properties.title.value'))
    entity_out.set('date', op_entity.get('properties.date.value'))
    entity_out.set('text', op_entity.get('properties.text.md'))
    // TODO: make sure URL starts with http://
    entity_out.set('url', op_entity.get('properties.url.value'))
    entity_out.set('source', op_entity.get('properties.source.value'))
    return entity_out.get()
}

var mapNews = function mapNews(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))
    entity_out.set('et-title', op_entity.get(['properties', 'et-title', 'value']))
    entity_out.set('en-title', op_entity.get(['properties', 'en-title', 'value']))
    entity_out.set('time',     op_entity.get(['properties', 'time',     'value']))
    entity_out.set('et-body',  op_entity.get(['properties', 'et-body',  'md']))
    entity_out.set('en-body',  op_entity.get(['properties', 'en-body',  'md']))
    entity_out.set('media',    op_entity.get(['properties', 'media',    'value']))
    return entity_out.get()
}

var mapCategory = function mapCategory(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    if (!entity) {
        // debug( 'Category ' + eid + ' not cached.')
        return
    }
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))
    entity_out.set('et-name', op_entity.get(['properties', 'et-name', 'value']))
    entity_out.set('en-name', op_entity.get(['properties', 'en-name', 'value']))
    entity_out.set('pl-id',   op_entity.get(['properties', 'pl-id',   'value']))
    return entity_out.get()
}

var mapLocation = function mapLocation(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    if (!entity) {
        // debug( 'Location ' + eid + ' not cached.')
        return
    }
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))
    entity_out.set('et-name', op_entity.get(['properties', 'et-name', 'value']))
    entity_out.set('en-name', op_entity.get(['properties', 'en-name', 'value']))
    entity_out.set('geo',     op_entity.get(['properties', 'geo',     'value']))
    return entity_out.get()
}

var mapUser = function mapUser(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))
    entity_out.set('picture', op_entity.get('picture'))
    entity_out.set('name', op_entity.get('displayname'))
    entity_out.set('phone', op_entity.get('properties.phone.value'))
    entity_out.set('email', op_entity.get('properties.email.value'))
    op_entity.get('properties.occupation', []).forEach(function stiterator(occupation) {
        entity_out.push('occupation', occupation.value)
    })
    entity_out.set('entity', op_entity.get())
    return entity_out.get()
}


exports.category    = mapCategory
exports.coverage    = mapCoverage
exports.event       = mapEvent
exports.news        = mapNews
exports.location    = mapLocation
exports.performance = mapPerformance
exports.user        = mapUser

exports.coverageByPerformanceSync = coverageByPerformanceSync
exports.coverageByEventSync       = coverageByEventSync
