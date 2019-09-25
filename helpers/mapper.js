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
    var coveragesByDate = {}
    coverages.forEach( function(coverage) {
      // debug(coverage)
      op.push(coveragesByDate, [coverage['date']], coverage)
      // debug(coveragesByDate)
    })
    return coveragesByDate
}
function coverageByEventSync(eventEid) {
    return coverageByPerformanceSync(SDC.get(['local_entities', 'by_eid', eventEid, 'properties', 'performance', 0, 'reference']))
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
    entityOut.set('et-name', opEntity.get(['properties', 'et-name', 0, 'value']))
    entityOut.set('en-name', opEntity.get(['properties', 'en-name', 0, 'value']))
    entityOut.set('pl-id',   opEntity.get(['properties', 'pl-id',   0, 'value']))
    return entityOut.get()
}

function mapEvent(eid) {
    eid = String(eid)
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', eid)
    entityOut.set('pl-id', opEntity.get(['properties', 'pl-id', 0, 'value']))

    var categories = []
    opEntity.get(['properties', 'category'], []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entityOut.set('category', categories.filter(function(category) { if (category) { return 1 } }))

    entityOut.set('color', opEntity.get(['properties', 'color', 0, 'value'], '').split('; '))
    entityOut.set('tag',   opEntity.get(['properties', 'tag',   0, 'value'], '').split('; '))
    if (opEntity.get(['properties', 'resident'], false)) {
        // debug('resident', opEntity.get('properties.resident'))
        entityOut.set('resident', opEntity.get(['properties', 'resident'], '').map(function(r) { return r.value }))
    }

    entityOut.set('en-name',        opEntity.get(['properties', 'en-name',        0, 'value'], ''))
    entityOut.set('et-name',        opEntity.get(['properties', 'et-name',        0, 'value'], ''))
    entityOut.set('en-subtitle',    opEntity.get(['properties', 'en-subtitle',    0, 'value'], ''))
    entityOut.set('et-subtitle',    opEntity.get(['properties', 'et-subtitle',    0, 'value'], ''))
    entityOut.set('en-description', opEntity.get(['properties', 'en-description', 0, 'md'], ''))
    entityOut.set('et-description', opEntity.get(['properties', 'et-description', 0, 'md'], ''))

    entityOut.set('photo',          opEntity.get(['properties', 'photo-big',      0]))
    entityOut.set('photos',         opEntity.get('properties.photo-medium', []).map( function(phm, ix) {
        return {
            medium: phm,
            big: opEntity.get(['properties', 'photo-gallery', ix])
        }
    }))
    entityOut.set('audio',    opEntity.get(['properties', 'audio',    0, 'value']))
    entityOut.set('audios',   opEntity.get(['properties', 'audio'], []).map(function(a) {
      return a.value
    }))
    entityOut.set('video',    opEntity.get(['properties', 'video',    0, 'value']))
    entityOut.set('videos',   opEntity.get(['properties', 'video'], []).map(function(a) {
      return a.value
    }))

    var locationId = opEntity.get(['properties', 'saal-location', 0, 'reference'])
    if (locationId) { entityOut.set('saal-location', mapLocation(locationId)) }

    entityOut.set('ordinal',                  opEntity.get(['properties', 'ordinal',               0, 'value'], 0))
    entityOut.set('et-location',              opEntity.get(['properties', 'et-location',           0, 'value']))
    entityOut.set('en-location',              opEntity.get(['properties', 'en-location',           0, 'value']))
    entityOut.set('location-url',             opEntity.get(['properties', 'location-url',          0, 'value']))
    entityOut.set('price',                    opEntity.get(['properties', 'price',                 0, 'value']))
    entityOut.set('onsite-price',             opEntity.get(['properties', 'onsite-price',          0, 'value']))
    entityOut.set('min-price',                opEntity.get(['properties', 'min-price',             0, 'value']))
    entityOut.set('max-price',                opEntity.get(['properties', 'max-price',             0, 'value']))
    entityOut.set('et-ticket-api',            opEntity.get(['properties', 'et-pl-link',            0, 'value']))
    entityOut.set('en-ticket-api',            opEntity.get(['properties', 'en-pl-link',            0, 'value']))
    entityOut.set('sales-status',             opEntity.get(['properties', 'sales-status',          0, 'value'], 'regular_presale'))
    if (entityOut.get('sales-status') === 'regular_presale' && !entityOut.get('price')) {
      entityOut.set('sales-status', '')
    }
    entityOut.set('en-technical-information', opEntity.get(['properties', 'en-technical-information', 0, 'md'], ''))
    entityOut.set('et-technical-information', opEntity.get(['properties', 'et-technical-information', 0, 'md'], ''))
    entityOut.set('start-time',               opEntity.get(['properties', 'start-time',            0, 'value']))
    entityOut.set('end-time',                 opEntity.get(['properties', 'end-time',              0, 'value']))
    entityOut.set('duration',                 opEntity.get(['properties', 'duration',              0, 'value']))

    entityOut.set('talk', opEntity.get(['properties', 'talk', 0, 'value']) === 'True')
    entityOut.set('canceled', opEntity.get(['properties', 'canceled', 0, 'value']) === 'True')

    var performanceId = opEntity.get(['properties', 'performance', 0, 'reference'])
    if (performanceId) {
        entityOut.set('performance', mapPerformance(performanceId))
        // debug('1: ' + JSON.stringify(entityOut.get('et-name'), null, 2))
        // debug('2: ' + JSON.stringify(entityOut.get(['performance', 'et-name']), null, 2))
        if (!entityOut.get('en-name')) {
            entityOut.set('en-name', entityOut.get(['performance', 'en-name'], ''))
        }
        if (!entityOut.get('et-name')) {
            entityOut.set('et-name', entityOut.get(['performance', 'et-name'], ''))
        }
        if (entityOut.get('en-description') === undefined) {
            entityOut.set('en-description', entityOut.get(['performance', 'en-description'], ''))
        }
        if (entityOut.get('et-description') === undefined) {
            entityOut.set('et-description', entityOut.get(['performance', 'et-description'], ''))
        }
        if (entityOut.get('en-subtitle') === undefined) {
            entityOut.set('en-subtitle', entityOut.get(['performance', 'en-subtitle'], ''))
        }
        if (entityOut.get('et-subtitle') === undefined) {
            entityOut.set('et-subtitle', entityOut.get(['performance', 'et-subtitle'], ''))
        }
        if (entityOut.get('en-supertitle') === undefined) {
            entityOut.set('en-supertitle', entityOut.get(['performance', 'en-supertitle'], ''))
        }
        if (entityOut.get('et-supertitle') === undefined) {
            entityOut.set('et-supertitle', entityOut.get(['performance', 'et-supertitle'], ''))
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
                entityOut.set('et-festival', SDC.get(['local_entities', 'by_eid', String(parentEid), 'properties', 'et-name', 0, 'value'], 'Festival'))
                entityOut.set('en-festival', SDC.get(['local_entities', 'by_eid', String(parentEid), 'properties', 'en-name', 0, 'value'], 'Festival'))
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

    entityOut.set('pl-id',          opEntity.get(['properties', 'pl-id',          0, 'value']))
    entityOut.set('en-name',        opEntity.get(['properties', 'en-name',        0, 'value'], ''))
    entityOut.set('et-name',        opEntity.get(['properties', 'et-name',        0, 'value'], ''))
    entityOut.set('en-subtitle',    opEntity.get(['properties', 'en-subtitle',    0, 'value'], ''))
    entityOut.set('et-subtitle',    opEntity.get(['properties', 'et-subtitle',    0, 'value'], ''))
    entityOut.set('en-supertitle',  opEntity.get(['properties', 'en-supertitle',  0, 'value'], ''))
    entityOut.set('et-supertitle',  opEntity.get(['properties', 'et-supertitle',  0, 'value'], ''))
    entityOut.set('en-description', opEntity.get(['properties', 'en-description', 0, 'md'], ''))
    entityOut.set('et-description', opEntity.get(['properties', 'et-description', 0, 'md'], ''))
    entityOut.set('coprodOrdinal',  opEntity.get(['properties', 'coprodOrdinal',  0, 'value']))
    entityOut.set('duration',       opEntity.get(['properties', 'duration',       0, 'value']))
    entityOut.set('artist',         opEntity.get(['properties', 'artist',         0, 'value'], ''))
    entityOut.set('producer',       opEntity.get(['properties', 'producer',       0, 'value'], ''))
    entityOut.set('et-town',        opEntity.get(['properties', 'et-town',        0, 'value'], ''))
    entityOut.set('en-town',        opEntity.get(['properties', 'en-town',        0, 'value'], ''))
    entityOut.set('photo',          opEntity.get(['properties', 'photo-big',      0]))
    entityOut.set('photos',         opEntity.get(['properties', 'photo-medium'], []).map( function(phm, ix) {
        return {
            medium: phm,
            big: opEntity.get(['properties', 'photo-gallery', ix])
        }
    }))
    entityOut.set('logo',     opEntity.get(['properties', 'logo'], []))
    entityOut.set('audio',    opEntity.get(['properties', 'audio',    0, 'value']))
    entityOut.set('audios',   opEntity.get(['properties', 'audio'], []).map(function(a) {
      return a.value
    }))
    entityOut.set('video',    opEntity.get(['properties', 'video',    0, 'value']))
    entityOut.set('videos',   opEntity.get(['properties', 'video'], []).map(function(a) {
      return a.value
    }))
    entityOut.set('featured', opEntity.get(['properties', 'featured', 0, 'value']) === 'True')
    entityOut.set('et-technical-information', opEntity.get(['properties', 'et-technical-information', 0, 'md'], ''))
    entityOut.set('en-technical-information', opEntity.get(['properties', 'en-technical-information', 0, 'md'], ''))
    entityOut.set('premiere.start-time', opEntity.get(['properties', 'premiere-time', 0, 'value']))

    // Map other works
    entityOut.set('otherWorks', SDC.get(['relationships', eid, 'otherWork'], []).map(function(a) {
        var enName = SDC.get(['local_entities', 'by_eid', a, 'properties', 'en-name', 0, 'value'])
        var etName = SDC.get(['local_entities', 'by_eid', a, 'properties', 'et-name', 0, 'value'])
        var artist = SDC.get(['local_entities', 'by_eid', a, 'properties', 'artist',  0, 'value'])
        return {
            'id': a,
            'en-name': enName === '' ? artist : enName,
            'et-name': etName === '' ? artist : etName
        }
    }))
    return entityOut.get()
}

function mapEcho(eid) {
    if (!eid) {
        return debug('mapEcho: No entity ID')
        // throw new EvalError('No entity ID')
    }
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    if (!entity) {
        // throw new ReferenceError('No entity cached by ID:' + eid)
        return debug('mapEcho: No entity cached by ID:' + eid)
    }
    if (op.get(entity, ['definition']) !== 'echo') {
        return debug('mapEcho: Entity ' + eid + ' is not an Echo')
        // throw new TypeError('Entity ' + eid + ' is not an Echo')
    }
    // debug('mapEcho: Mapping Echo ' + eid + '.')

    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id', opEntity.get('id'))

    var categories = []
    opEntity.get('properties.category', []).forEach(function catiterator(category) {
        categories.push(mapCategory(category.reference))
    })
    entityOut.set('category', categories.filter(function(category) { if (category) { return 1 } }))

    entityOut.set('en-title',       opEntity.get(['properties', 'en-title',    0, 'value']))
    entityOut.set('et-title',       opEntity.get(['properties', 'et-title',    0, 'value']))
    entityOut.set('en-subtitle',    opEntity.get(['properties', 'en-subtitle', 0, 'value']))
    entityOut.set('et-subtitle',    opEntity.get(['properties', 'et-subtitle', 0, 'value']))
    entityOut.set('en-contents',    opEntity.get(['properties', 'en-contents', 0, 'md']))
    entityOut.set('et-contents',    opEntity.get(['properties', 'et-contents', 0, 'md']))
    entityOut.set('featured',       opEntity.get(['properties', 'featured',    0, 'value']) === 'True')
    entityOut.set('hide-gallery',   opEntity.get(['properties', 'hide-gallery',0, 'value']) === 'True')
    entityOut.set('photo',          opEntity.get(['properties', 'photo-big',   0]))
    entityOut.set('author',         opEntity.get(['properties', 'author'], []))
    if (opEntity.get(['properties', 'photo-medium'], false)) {
        entityOut.set('photos', opEntity.get(['properties', 'photo-medium'], []).map( function(phm, ix) {
            return {
                ix: ix,
                medium: phm,
                big: opEntity.get(['properties', 'photo-big', ix])
            }
        }))
    } else if (opEntity.get(['properties', 'photo-big'], false)) {
      entityOut.set('photos', opEntity.get(['properties', 'photo-big'], []).map( function(phb, ix) {
        return {
            ix: ix,
            big: phb,
            medium: opEntity.get(['properties', 'photo-medium', ix])
        }
      }))
    }
    entityOut.set('audio', opEntity.get(['properties', 'audio'],[]).map(function(a){ return a.value }))
    entityOut.set('video', opEntity.get(['properties', 'video'],[]).map(function(a){ return a.value }))

    var date = opEntity.get(['properties', 'date', 0, 'value'])
    if (date) {
        entityOut.set('date', date)
        entityOut.set('year',  date.slice(0,4))
        entityOut.set('month', date.slice(5,7))
        entityOut.set('day',   date.slice(8,10))
    }

    return entityOut.get()
}

function mapCoverage(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid], {})
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id',     opEntity.get(['id']))
    entityOut.set('title',  opEntity.get(['properties', 'title',  0, 'value']))
    entityOut.set('date',   opEntity.get(['properties', 'date',   0, 'value']))
    entityOut.set('text',   opEntity.get(['properties', 'text',   0, 'md']))
    // TODO: make sure URL starts with http://
    entityOut.set('url',    opEntity.get(['properties', 'url',    0, 'value']))
    entityOut.set('photo',  opEntity.get(['properties', 'photo',  0]))
    entityOut.set('source', opEntity.get(['properties', 'source', 0, 'value']))
    return entityOut.get()
}

function mapNews(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid], {})
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id',       opEntity.get(['id']))
    entityOut.set('et-title', opEntity.get(['properties', 'et-title', 0, 'value']))
    entityOut.set('en-title', opEntity.get(['properties', 'en-title', 0, 'value']))
    entityOut.set('time',     opEntity.get(['properties', 'time',     0, 'value']))
    entityOut.set('et-body',  opEntity.get(['properties', 'et-body',  0, 'md']))
    entityOut.set('en-body',  opEntity.get(['properties', 'en-body',  0, 'md']))
    entityOut.set('media',    opEntity.get(['properties', 'media',    0, 'value']))
    return entityOut.get()
}

function mapLocation(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid], {})
    if (!entity) {
        // debug( 'Location ' + eid + ' not cached.')
        return
    }
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id',             opEntity.get(['id']))
    entityOut.set('et-name',        opEntity.get(['properties', 'et-name',     0, 'value']))
    entityOut.set('en-name',        opEntity.get(['properties', 'en-name',     0, 'value']))
    entityOut.set('geo',            opEntity.get(['properties', 'geo',         0, 'value']))
    entityOut.set('et-description', opEntity.get(['properties', 'et-description', 0, 'value']))
    entityOut.set('en-description', opEntity.get(['properties', 'en-description', 0, 'value']))
    entityOut.set('floorplan',      opEntity.get(['properties', 'floorplan']))
    return entityOut.get()
}

function mapUser(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid], {})
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id',         opEntity.get(['id']))
    entityOut.set('ordinal',    opEntity.get(['properties', 'ordinal', 0, 'value'], 0))
    entityOut.set('picture',    opEntity.get(['picture']))
    entityOut.set('name',       opEntity.get(['displayname']))
    entityOut.set('phone',      opEntity.get(['properties', 'phone',   0, 'value']))
    entityOut.set('email',      opEntity.get(['properties', 'email',   0, 'value']))
    opEntity.get(['properties', 'occupation'], []).forEach(function stiterator(occupation) {
        entityOut.push('occupation', occupation.value)
    })
    entityOut.set('entity', opEntity.get())
    return entityOut.get()
}

function mapBanner(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid], {})
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id',         opEntity.get(['id']))
    entityOut.set('ordinal',    opEntity.get(['properties', 'ordinal', 0, 'value'], 0))
    entityOut.set('photos',     opEntity.get(['properties', 'photo']))
    entityOut.set('name',       opEntity.get(['properties', 'name',    0, 'value']))
    entityOut.set('url',        opEntity.get(['properties', 'url',     0, 'value']))
    entityOut.set('start',      opEntity.get(['properties', 'start',   0, 'value']))
    entityOut.set('end',        opEntity.get(['properties', 'end',     0, 'value']))

    opEntity.get(['properties', 'type'], []).forEach(function stiterator(type) {
        entityOut.push('type', type.reference)
    })

    // debug('1: ' + JSON.stringify(entityOut.get(), null, 2))
    return entityOut.get()
}

function mapBannerType(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid], {})
    var opEntity = op(entity)
    var entityOut = op({})
    entityOut.set('id',     opEntity.get(['id']))
    entityOut.set('name',   opEntity.get(['properties', 'name',   0, 'value']))
    entityOut.set('width',  opEntity.get(['properties', 'width',  0, 'value']))
    entityOut.set('height', opEntity.get(['properties', 'height', 0, 'value']))
    return entityOut.get()
}


exports.banner      = mapBanner
exports.bannerType  = mapBannerType
exports.category    = mapCategory
exports.coverage    = mapCoverage
exports.echo        = mapEcho
exports.event       = mapEvent
exports.location    = mapLocation
exports.news        = mapNews
exports.performance = mapPerformance
exports.user        = mapUser

exports.coverageByPerformanceSync = coverageByPerformanceSync
exports.coverageByEventSync       = coverageByEventSync
