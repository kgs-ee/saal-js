var path     = require('path')
var debug    = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request  = require('request')
var async    = require('async')
var op       = require('object-path')
var md       = require('marked')
var random   = require('randomstring')
var crypto   = require('crypto')
var sanitize = require('sanitize-html')


LIMIT_PARALLEL = 10

function sign_data(data) {
    data = data || {}

    if(!APP_ENTU_USER || !APP_ENTU_KEY) return data

    var conditions = []
    for(k in data) {
        conditions.push({k: data[k]})
    }

    var expiration = new Date()
    expiration.setMinutes(expiration.getMinutes() + 10)

    data.user = APP_ENTU_USER
    var buff_str = JSON.stringify({expiration: expiration.toISOString(), conditions: conditions})
    data.policy = new Buffer(buff_str).toString('base64')
    data.signature = crypto.createHmac('sha1', APP_ENTU_KEY).update(data.policy).digest('base64')

    return data
}


//Get entity from Entu
exports.get_entity = get_entity
function get_entity(id, auth_id, auth_token, callback) {
    if(auth_id && auth_token) {
        debug('auth://' + APP_ENTU_URL + '/entity-' + id)
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
        var qs = {}
    } else {
        debug('sign://' + APP_ENTU_URL + '/entity-' + id)
        var headers = {}
        var qs = sign_data()
    }

    request.get({url: APP_ENTU_URL + '/entity-' + id, headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
        if(error) return callback(error)
        if(response.statusCode !== 200 || !body.result) return callback(new Error(op.get(body, 'error', body)))

        var properties = op.get(body, 'result.properties', {})
        var entity = {
            id: op.get(body, 'result.id', null),
            displayname: op.get(body, 'result.displayname', null),
            displayinfo: op.get(body, 'result.displayinfo', null),
            definition: op.get(body, 'result.definition.keyname', null),
            picture: APP_ENTU_URL + '/entity-' + op.get(body, 'result.id', null) + '/picture',
            right: op.get(body, 'result.right', null),
            properties: {}
        }
        for(var p in properties) {
            if(op.has(properties, [p, 'values'])) {
                for(var v in op.get(properties, [p, 'values'])) {
                    if(op.get(properties, [p, 'datatype']) === 'file') {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: sanitize(op.get(properties, [p, 'values', v, 'value'])),
                            file: APP_ENTU_URL + '/file-' + op.get(properties, [p, 'values', v, 'db_value'])
                        })
                    } else if(op.get(properties, [p, 'datatype']) === 'text') {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: sanitize(op.get(properties, [p, 'values', v, 'value'])),
                            md: md(sanitize(op.get(properties, [p, 'values', v, 'db_value'])))
                        })
                    } else if(op.get(properties, [p, 'datatype']) === 'reference') {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: sanitize(op.get(properties, [p, 'values', v, 'value'])),
                            reference: op.get(properties, [p, 'values', v, 'db_value'])
                        })
                    } else {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: sanitize(op.get(properties, [p, 'values', v, 'value'])),
                        })
                    }
                }
                if(op.get(properties, [p, 'multiplicity']) === 1) op.set(entity, ['properties', p], op.get(entity, ['properties', p, 0]))
            }
        }
        // debug(JSON.stringify(entity, null, '  '))

        callback(null, op(entity))
    })
}



//Get entities by definition
exports.get_entities = function(definition, auth_id, auth_token, callback) {
    if (!definition) callback(new Error('Missing "definition"'))
    if(auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
        var qs = definition ? {definition: definition} : {}
    } else {
        var headers = {}
        var qs = definition ? sign_data({definition: definition}) : sign_data()
    }

    var url = '/entity'
    var loop = 'result'

    request.get({url: APP_ENTU_URL + url, headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
        if(error) return callback(error)
        if(response.statusCode !== 200 || !body.result) return callback(new Error(op.get(body, 'error', body)))

        var entities = []
        async.eachLimit(op.get(body, loop, []), LIMIT_PARALLEL, function(e, callback) {
            get_entity(e.id, auth_id, auth_token, function(error, entity) {
                if(error) return callback(error)

                entities.push(entity)
                callback()
            })
        }, function(error){
            if(error) return callback(error)

            callback(null, entities)
        })
    })
}


//Get childs by parent entity id and optionally by definition
exports.get_childs = function get_childs(parent_entity_id, definition, auth_id, auth_token, callback) {
    if (!parent_entity_id) callback(new Error('Missing "parent_entity_id"'))
    if(auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
        var qs = definition ? {definition: definition} : {}
    } else {
        var headers = {}
        var qs = definition ? sign_data({definition: definition}) : sign_data()
    }
    var url = '/entity-' + parent_entity_id + '/childs'


    // debug(parent_entity_id, definition)

    debug(APP_ENTU_URL + url)
    request.get({url: APP_ENTU_URL + url, headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
        if(error) return callback(error)
        if(response.statusCode !== 200 || !body.result) return callback(new Error(op.get(body, 'error', body)))

        var definitions = Object.keys(body.result)
        var childs = []
        async.eachLimit(
            definitions,
            LIMIT_PARALLEL,
            function doLoop(definition, callback) {
                var loop = ['result', definition, 'entities']
                // debug(loop)
                async.each(op.get(body, loop, []), function(e, callback) {
                    // debug(e)
                    get_entity(e.id, auth_id, auth_token, function(error, child_e) {
                        if(error) return callback(error)

                        child_e.set('_display', {name: e.name, info: e.info})
                        // debug(child_e)

                        childs.push(child_e)
                        callback()
                    })
                }, function gotByDef(error) {
                    if(error) return callback(error)
                    // debug('endInnerLoop')
                    callback(null)
                })
            },
            function endLoop(error) {
                if(error) return callback(error)
                // debug('endDefLoop')

                // debug(JSON.stringify(body, null, '  '))
                callback(null, childs)
            }
        )
        // debug(JSON.stringify(body, null, '  '))

    })
}

