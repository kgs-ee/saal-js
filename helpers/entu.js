var path     = require('path')
var debug    = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request  = require('request')
var async    = require('async')
var op       = require('object-path')
var md       = require('marked')
var random   = require('randomstring')
var crypto   = require('crypto')
// var sanitize = require('sanitize-html')


LIMIT_PARALLEL = 3

function sign_data(data) {
    data = data || {}

    if (!APP_ENTU_USER || !APP_ENTU_KEY) return data

    var conditions = []
    for (k in data) {
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
var get_entity = function get_entity(id, auth_id, auth_token, callback) {
    if (auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
        var qs = {}
    } else {
        var headers = {}
        var qs = sign_data()
    }

    // debug('get_entity: ' + APP_ENTU_URL + '/entity-' + id)
    request.get({url: APP_ENTU_URL + '/entity-' + id, headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
        if (error) {
            return callback(error)
        }
        if (response.statusCode !== 200 || !body.result) return callback(new Error(op.get(body, 'error', body)))
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
        for (var p in properties) {
            if (op.has(properties, [p, 'values'])) {
                for (var v in op.get(properties, [p, 'values'])) {
                    if (op.get(properties, [p, 'datatype']) === 'file') {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: op.get(properties, [p, 'values', v, 'value']),
                            file: APP_ENTU_URL + '/file-' + op.get(properties, [p, 'values', v, 'db_value'])
                        })
                    } else if (op.get(properties, [p, 'datatype']) === 'text') {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: op.get(properties, [p, 'values', v, 'value']),
                            md: md(op.get(properties, [p, 'values', v, 'db_value']))
                        })
                    } else if (op.get(properties, [p, 'datatype']) === 'reference') {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: op.get(properties, [p, 'values', v, 'value']),
                            reference: op.get(properties, [p, 'values', v, 'db_value'])
                        })
                    } else {
                        op.push(entity, ['properties', p], {
                            id: op.get(properties, [p, 'values', v, 'id']),
                            value: op.get(properties, [p, 'values', v, 'value']),
                        })
                    }
                }
                if (op.get(properties, [p, 'multiplicity']) === 1) op.set(entity, ['properties', p], op.get(entity, ['properties', p, 0]))
            }
        }
        // debug(JSON.stringify(entity, null, '  '))
        callback(null, op(entity))
    })
}


//Get entities by definition
var get_entities = function get_entities(definition, limit, auth_id, auth_token, callback) {
    if (!definition) {
        callback(new Error('Missing "definition"'))
        return
    }

    var qs = {definition: definition}
    if (limit) {
        qs['limit'] = limit
    }
    if (auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
    } else {
        var headers = {}
        qs = sign_data(qs)
    }

    var url = '/entity'
    var loop = 'result'

    // debug('get_entities: ' + APP_ENTU_URL + url)
    request.get({url: APP_ENTU_URL + url, headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
        if (error) {
            return callback(error)
        }
        if (response.statusCode !== 200 || !body.result) return callback(new Error(op.get(body, 'error', body)))

        var entities = []
        async.eachLimit(op.get(body, loop, []), LIMIT_PARALLEL, function(e, callback) {
            get_entity(e.id, auth_id, auth_token, function(error, op_entity) {
                if (error) {
                    return callback(error)
                }
                entities.push(op_entity)
                callback()
            })
        }, function(error) {
            if (error) {
                return callback(error)
            }
            // debug(definition + ' returned ' +  entities.length + ' entities.')
            callback(null, entities)
        })
    })
}


//Get childs by parent entity id and optionally by definition
var get_childs = function get_childs(parent_entity_id, definition, auth_id, auth_token, callback) {
    if (!parent_entity_id) {
        callback(new Error('Missing "parent_entity_id"'))
        return
    }
    // debug('get childs for ' + parent_entity_id)
    var qs = {}
    if (definition) {
        qs = {definition: definition}
    }

    if (auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
    } else {
        var headers = {}
        qs = sign_data(qs)
    }
    var url = '/entity-' + parent_entity_id + '/childs'
    // debug('get_childs: ' + APP_ENTU_URL + url)
    var options = {
        url: APP_ENTU_URL + url,
        headers: headers,
        qs: qs,
        strictSSL: true,
        json: true
    }
    request.get(options, function(error, response, body) {
        if (error) {
            callback(error)
            return
        }
        if (response.statusCode !== 200 || !body.result) {
            callback(new Error(op.get(body, 'error', body)))
            return
        }

        var definitions = Object.keys(body.result)
        var childs = []
        async.eachLimit(
            definitions,
            LIMIT_PARALLEL,
            function doLoop(definition, doLoopCB) {
                var loop = ['result', definition, 'entities']
                async.each(op.get(body, loop, []), function(e, eachCB) {
                    get_entity(e.id, auth_id, auth_token, function(error, child_e) {
                        if (error) {
                            eachCB(error)
                            return
                        }
                        child_e.set('_display', {name: e.name, info: e.info})
                        childs.push(child_e)
                        eachCB()
                    })
                }, function gotByDef(error) {
                    if (error) {
                        doLoopCB(error)
                        return
                    }
                    doLoopCB(null)
                })
            },
            function endLoop(error) {
                if (error) {
                    callback(error)
                    return
                }
                // debug(parent_entity_id + ' has ' +  childs.length + ' childs.')
                callback(null, childs)
            }
        )
    })
}


//Add entity
var add = function add(parent_entity_id, definition, properties, auth_id, auth_token, callback) {
    var data = {
        definition: definition
    }

    for (p in properties) {
        data[definition + '-' + p] = properties[p]
    }

    if (auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
        var qb = data
    } else {
        var headers = {}
        var qb = sign_data(data)
    }

    var options = {
        url: APP_ENTU_URL + '/entity-' + parent_entity_id,
        headers: headers,
        body: qb,
        strictSSL: true,
        json: true
    }
    // debug(JSON.stringify(options, null, 4))
    request.post(options, function(error, response, body) {
        if (error) {
            debug('E:', error)
            callback(error)
            return
        }
        if (response.statusCode !== 201 || !body.result) {
            debug('E:' + response.statusCode, body)
            callback(new Error(op.get(body, 'error', body)))
            return
        }
        callback(null, op.get(body, 'result.id', null))
    })
}



//Share entity
var rights = function rights(id, person_id, right, auth_id, auth_token, callback) {
    var body = {
        entity: person_id,
        right: right
    }
    if(auth_id && auth_token) {
        var headers = {'X-Auth-UserId': auth_id, 'X-Auth-Token': auth_token}
        var qb = body
    } else {
        var headers = {}
        var qb = sign_data(body)
    }

    request.post({url: APP_ENTU_URL + '/entity-' + id + '/rights', headers: headers, body: qb, strictSSL: true, json: true}, function(error, response, body) {
        if(error) return callback(error)
        if(response.statusCode !== 200) return callback(new Error(op.get(body, 'error', body)))

        callback(null, id)
    })
}



exports.get_entity      = get_entity
exports.get_childs      = get_childs
exports.get_entities    = get_entities
exports.add             = add
exports.rights          = rights
