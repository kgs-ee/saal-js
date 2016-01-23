var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
// var async   = require('async')
var op      = require('object-path')

debug('Entity mapper ready to serve')


function coverageByPerformanceSync(performanceEid) {
    var coverages = SDC.get(['relationships', performanceEid, 'coverage'], []).map(function(eid) {
        return mapCoverage(eid)
    })
    SDC.get(['relationships', performanceEid, 'event'], []).forEach(function(eventEid) {
        coverages = coverages.concat(
            SDC.get(['relationships', eventEid, 'coverage'], []).map(function(eid) {
                return mapCoverage(eid)
            })
        )
    })
    return coverages
}
function coverageByEventSync(eventEid) {
    return coverageByPerformanceSync(SDC.get(['local_entities', 'by_eid', eventEid, 'properties', 'performance', 'id']))
}

function mapCategory(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    if (!entity) {
        // debug( 'Category ' + eid + ' not cached.')
        return
    }
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('et-name', opEntity.get(['properties', 'et-name', 'value']))
    entityOut.set('en-name', opEntity.get(['properties', 'en-name', 'value']))
    entityOut.set('pl-id',   opEntity.get(['properties', 'pl-id',   'value']))
    return entityOut.get()
}

function mapEvent(eid) {
    eid = String(eid)
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', eid)
    entityOut.set('pl-id', opEntity.get('properties.pl-id.value'))

    var categories = []
    opEntity.get('properties.category', []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entityOut.set('category', categories.filter(function(category) { if (category) { return 1 } }))

    entityOut.set('color', opEntity.get('properties.color.value', '').split('; '))
    entityOut.set('tag', opEntity.get('properties.tag.value', '').split('; '))
    if (opEntity.get('properties.resident', false)) {
        // debug('resident', opEntity.get('properties.resident'))
        entityOut.set('resident', opEntity.get('properties.resident', '').map(function(r) {return r.value}))
    }

    entityOut.set('en-name', opEntity.get('properties.en-name.value'))
    entityOut.set('et-name', opEntity.get('properties.et-name.value'))
    entityOut.set('en-subtitle', opEntity.get('properties.en-subtitle.value'))
    entityOut.set('et-subtitle', opEntity.get('properties.et-subtitle.value'))
    entityOut.set('en-description', opEntity.get('properties.en-description.md'))
    entityOut.set('et-description', opEntity.get('properties.et-description.md'))
    entityOut.set('photo', opEntity.get(['properties', 'photo-big', 0]))
    entityOut.set('photos', opEntity.get('properties.photo-medium', []).map( function(phm, ix) {
        return {
            medium: phm,
            big: opEntity.get(['properties', 'photo-big', ix])
        }
    }))
    entityOut.set('video', opEntity.get('properties.video.value'))

    var locationId = opEntity.get('properties.saal-location.reference')
    if (locationId) { entityOut.set('saal-location', mapLocation(locationId)) }

    entityOut.set('location', opEntity.get('properties.location.value'))
    entityOut.set('price', opEntity.get('properties.price.value'))
    entityOut.set('onsite-price', opEntity.get(['properties', 'onsite-price', 'value']))
    entityOut.set('min-price', opEntity.get('properties.min-price.value'))
    entityOut.set('max-price', opEntity.get('properties.max-price.value'))
    entityOut.set('ticket-api', opEntity.get('properties.pl-link.value'))
    entityOut.set('sales-status', opEntity.get('properties.sales-status.value'))
    entityOut.set('en-technical-information', opEntity.get('properties.en-technical-information.md'))
    entityOut.set('et-technical-information', opEntity.get('properties.et-technical-information.md'))

    entityOut.set('start-time', opEntity.get('properties.start-time.value'))
    entityOut.set('end-time', opEntity.get('properties.end-time.value'))
    entityOut.set('duration', opEntity.get('properties.duration.value'))
    entityOut.set('ordinal', opEntity.get('properties.ordinal.value'))

    var performanceId = opEntity.get('properties.performance.reference')
    if (performanceId) {
        entityOut.set('performance', mapPerformance(performanceId))
        // debug('1: ' + JSON.stringify(entityOut.get('et-name'), null, 2))
        // debug('2: ' + JSON.stringify(entityOut.get(['performance', 'et-name']), null, 2))
        if (entityOut.get('en-name') !== undefined) {
            entityOut.set('en-name', entityOut.get(['performance', 'en-name']))
        }
        if (entityOut.get('et-name') !== undefined) {
            entityOut.set('et-name', entityOut.get(['performance', 'et-name']))
        }
        if (entityOut.get('en-description') === undefined) {
            entityOut.set('en-description', entityOut.get(['performance', 'en-description']))
        }
        if (entityOut.get('et-description') === undefined) {
            entityOut.set('et-description', entityOut.get(['performance', 'et-description']))
        }
        if (entityOut.get('en-subtitle') === undefined) {
            entityOut.set('en-subtitle', entityOut.get(['performance', 'en-subtitle']))
        }
        if (entityOut.get('et-subtitle') === undefined) {
            entityOut.set('et-subtitle', entityOut.get(['performance', 'et-subtitle']))
        }
        if (entityOut.get('en-supertitle') === undefined) {
            entityOut.set('en-supertitle', entityOut.get(['performance', 'en-supertitle']))
        }
        if (entityOut.get('et-supertitle') === undefined) {
            entityOut.set('et-supertitle', entityOut.get(['performance', 'et-supertitle']))
        }
        // debug('3: ' + JSON.stringify(entityOut.get('et-name'), null, 2))
    }

    // look for grandparents and if its a "festivals", then add extra "festival" property to event
    // where festival name comes from parent that relates to "festivals" grandparent.
    var parentEids = SDC.get(['relationships', eid, 'parent'], []).map(function(i) {return parseInt(i, 10)})
    // TODO: get rid of this extremely ugly grandparent hack :D
    var grandparentEids = [].concat.apply([],
        parentEids.map(function (parentEid) {
            if (SDC.get(['relationships', parentEid, 'parent'], [])
                   .map(function(i) {return parseInt(i, 10)})
                   .indexOf(parseInt(SDC.get(['mappings', 'festival']), 10)) > -1) {
                entityOut.set('et-festival', SDC.get(['local_entities', 'by_eid', String(parentEid), 'properties', 'et-name', 'value'], 'Festival'))
                entityOut.set('en-festival', SDC.get(['local_entities', 'by_eid', String(parentEid), 'properties', 'en-name', 'value'], 'Festival'))
            }
        })
    )
    // debug(entityOut.get())
    return entityOut.get()
}

function mapPerformance(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))

    var categories = []
    opEntity.get('properties.category', []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entityOut.set('category', categories.filter(function(category) { if (category) { return 1 } }))

    entityOut.set('pl-id', opEntity.get('properties.pl-id.value'))
    entityOut.set('en-name', opEntity.get('properties.en-name.value'))
    entityOut.set('et-name', opEntity.get('properties.et-name.value'))
    entityOut.set('en-subtitle', opEntity.get('properties.en-subtitle.value'))
    entityOut.set('et-subtitle', opEntity.get('properties.et-subtitle.value'))
    entityOut.set('en-supertitle', opEntity.get('properties.en-supertitle.value'))
    entityOut.set('et-supertitle', opEntity.get('properties.et-supertitle.value'))
    entityOut.set('en-description', opEntity.get('properties.en-description.md'))
    entityOut.set('et-description', opEntity.get('properties.et-description.md'))
    entityOut.set('artist', opEntity.get('properties.artist.value'))
    entityOut.set('producer', opEntity.get('properties.producer.value'))
    entityOut.set('town', opEntity.get('properties.town.value'))
    entityOut.set('photo', opEntity.get(['properties', 'photo-big', 0]))
    entityOut.set('photos', opEntity.get('properties.photo-medium', []).map( function(phm, ix) {
        return {
            medium: phm,
            big: opEntity.get(['properties', 'photo-big', ix])
        }
    }))
    entityOut.set('audio', opEntity.get('properties.audio.value'))
    entityOut.set('video', opEntity.get('properties.video.value'))
    entityOut.set('featured', opEntity.get('properties.featured.value') === 'True')
    entityOut.set('et-technical-information', opEntity.get('properties.et-technical-information.md'))
    entityOut.set('en-technical-information', opEntity.get('properties.en-technical-information.md'))
    entityOut.set('premiere.start-time', opEntity.get('properties.premiere-time.value'))
    return entityOut.get()
}

function mapEcho(eid) {
    if (!eid) {
        debug('mapEcho: No entity ID')
        throw new EvalError('No entity ID')
    }
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    if (!entity) {
        throw new ReferenceError('No entity cached by ID:' + eid)
        debug('mapEcho: No entity cached by ID:' + eid)
    }
    if (entity.definition !== 'echo') {
        debug('mapEcho: Entity ' + eid + ' is not an Echo')
        throw new TypeError('Entity ' + eid + ' is not an Echo')
    }
    debug('mapEcho: Mapping Echo ' + eid + '.') 

    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))

    var categories = []
    opEntity.get('properties.category', []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entityOut.set('category', categories.filter(function(category) { if (category) { return 1 } }))

    entityOut.set('en-title', opEntity.get('properties.en-title.value'))
    entityOut.set('et-title', opEntity.get('properties.et-title.value'))
    entityOut.set('en-subtitle', opEntity.get('properties.en-subtitle.value'))
    entityOut.set('et-subtitle', opEntity.get('properties.et-subtitle.value'))
    entityOut.set('en-contents', opEntity.get('properties.en-contents.md'))
    entityOut.set('et-contents', opEntity.get('properties.et-contents.md'))
    entityOut.set('author', opEntity.get('properties.author.value'))
    entityOut.set('photo', opEntity.get(['properties', 'photo-big', 0]))
    entityOut.set('photos', opEntity.get('properties.photo-medium', []).map( function(phm, ix) {
        return {
            medium: phm,
            big: opEntity.get(['properties', 'photo-big', ix])
        }
    }))
    entityOut.set('audio', opEntity.get('properties.audio.value'))
    entityOut.set('video', opEntity.get('properties.video.value'))

    var date = opEntity.get('properties.date.value')
    entityOut.set('date', date)
    entityOut.set('year',  date.slice(0,4))
    entityOut.set('month', date.slice(5,7))
    entityOut.set('day',   date.slice(8,10))

    return entityOut.get()
}

function mapCoverage(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('title', opEntity.get('properties.title.value'))
    entityOut.set('date', opEntity.get('properties.date.value'))
    entityOut.set('text', opEntity.get('properties.text.md'))
    // TODO: make sure URL starts with http://
    entityOut.set('url', opEntity.get('properties.url.value'))
    entityOut.set('source', opEntity.get('properties.source.value'))
    return entityOut.get()
}

function mapNews(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('et-title', opEntity.get(['properties', 'et-title', 'value']))
    entityOut.set('en-title', opEntity.get(['properties', 'en-title', 'value']))
    entityOut.set('time',     opEntity.get(['properties', 'time',     'value']))
    entityOut.set('et-body',  opEntity.get(['properties', 'et-body',  'md']))
    entityOut.set('en-body',  opEntity.get(['properties', 'en-body',  'md']))
    entityOut.set('media',    opEntity.get(['properties', 'media',    'value']))
    return entityOut.get()
}

function mapLocation(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    if (!entity) {
        // debug( 'Location ' + eid + ' not cached.')
        return
    }
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('et-name', opEntity.get(['properties', 'et-name', 'value']))
    entityOut.set('en-name', opEntity.get(['properties', 'en-name', 'value']))
    entityOut.set('geo',     opEntity.get(['properties', 'geo',     'value']))
    entityOut.set('floorplan', opEntity.get('properties.floorplan'))
    return entityOut.get()
}

function mapUser(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('picture', opEntity.get('picture'))
    entityOut.set('name', opEntity.get('displayname'))
    entityOut.set('phone', opEntity.get(['properties', 'phone', 'value']))
    entityOut.set('email', opEntity.get(['properties', 'email', 'value']))
    opEntity.get(['properties', 'occupation'], []).forEach(function stiterator(occupation) {
        entityOut.push('occupation', occupation.value)
    })
    entityOut.set('entity', opEntity.get())
    return entityOut.get()
}

function mapBanner(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('photos', opEntity.get(['properties', 'photo']))
    entityOut.set('name', opEntity.get(['properties', 'name', 'value']))
    entityOut.set('ordinal', opEntity.get(['properties', 'ordinal', 'value'], 0))
    entityOut.set('url', opEntity.get(['properties', 'url', 'value']))
    entityOut.set('start', opEntity.get(['properties', 'start', 'value']))
    entityOut.set('end', opEntity.get(['properties', 'end', 'value']))

    opEntity.get(['properties', 'type'], []).forEach(function stiterator(type) {
        entityOut.push('type', type.reference)
    })

    // debug('1: ' + JSON.stringify(entityOut.get(), null, 2))
    return entityOut.get()
}

function mapBannerType(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))
    entityOut.set('name', opEntity.get('properties.name.value'))
    entityOut.set('width', opEntity.get('properties.width.value'))
    entityOut.set('height', opEntity.get('properties.height.value'))
    return entityOut.get()
}


exports.category    = mapCategory
exports.coverage    = mapCoverage
exports.event       = mapEvent
exports.news        = mapNews
exports.location    = mapLocation
exports.performance = mapPerformance
exports.user        = mapUser
exports.echo        = mapEcho
exports.banner      = mapBanner
exports.bannerType  = mapBannerType

exports.coverageByPerformanceSync = coverageByPerformanceSync
exports.coverageByEventSync       = coverageByEventSync
