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

var mapEvent = function event(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', eid)
    entity_out.set('category', op_entity.get('properties.category'))
    entity_out.set('color', op_entity.get('properties.color.value', '').split('; '))
    entity_out.set('tag', op_entity.get('properties.tag.value', '').split('; '))
    entity_out.set('en-name', op_entity.get('properties.en-name.value'))
    entity_out.set('et-name', op_entity.get('properties.et-name.value'))
    entity_out.set('en-description', op_entity.get('properties.en-description.md'))
    entity_out.set('et-description', op_entity.get('properties.et-description.md'))
    entity_out.set('photo', op_entity.get('properties.photo.0'))
    entity_out.set('photos', op_entity.get('properties.photo'))
    entity_out.set('video', op_entity.get('properties.video.value'))
    entity_out.set('location', op_entity.get('properties.location.value'))
    entity_out.set('price', op_entity.get('properties.price.value'))
    entity_out.set('ticket-api', op_entity.get('properties.ticket-api.value'))
    entity_out.set('en-technical-information', op_entity.get('properties.en-technical-information.md'))
    entity_out.set('et-technical-information', op_entity.get('properties.et-technical-information.md'))

    entity_out.set('start-time', [])
    op_entity.get('properties.start-time', []).forEach(function stiterator(start_time) {
        entity_out.push('start-time', start_time.value)
    })

    if (performance_id = op_entity.get('properties.performance.reference')) {
        entity_out.set('performance', mapPerformance(performance_id))
    }

    debug(entity_out.get())
    return entity_out.get()
}

var mapPerformance = function mapPerformance(eid) {
    var entity = SDC.get(['local_entities', 'by_eid', eid])
    var op_entity = op(entity)
    var entity_out = op({})
    entity_out.set('id', op_entity.get('id'))
    entity_out.set('category', op_entity.get('properties.category'))
    entity_out.set('pl-id', op_entity.get('properties.pl-id.value'))
    entity_out.set('en-name', op_entity.get('properties.en_name.value'))
    entity_out.set('et-name', op_entity.get('properties.et_name.value'))
    entity_out.set('en-subtitle', op_entity.get('properties.en_subtitle.value'))
    entity_out.set('et-subtitle', op_entity.get('properties.et_subtitle.value'))
    entity_out.set('en-description', op_entity.get('properties.en-description.md'))
    entity_out.set('et-description', op_entity.get('properties.et-description.md'))
    entity_out.set('photo', op_entity.get('properties.photo.0'))
    entity_out.set('photos', op_entity.get('properties.photo'))
    entity_out.set('audio', op_entity.get('properties.audio.value'))
    entity_out.set('video', op_entity.get('properties.video.value'))
    entity_out.set('et-technical-information', op_entity.get('properties.et-technical-information.md'))
    entity_out.set('en-technical-information', op_entity.get('properties.en-technical-information.md'))
    entity_out.set('premiere.start-time', op_entity.get('properties.premiere-time.value'))
    return entity_out.get()
}

var mapCoverage = function mapCoverage(entity_in) {
    var entity_out = op({})
    entity_out.set('id', entity_in.get('id'))
    entity_out.set('title', entity_in.get('properties.title.value'))
    entity_out.set('date', entity_in.get('properties.date.value'))
    entity_out.set('text', entity_in.get('properties.text.md'))
    entity_out.set('url', entity_in.get('properties.url.value'))
    entity_out.set('source', entity_in.get('properties.source.value'))
    return entity_out.get()
}


exports.event = mapEvent
exports.performance = mapPerformance
exports.coverage = mapCoverage
