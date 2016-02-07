var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request   = require('request')
var async     = require('async')
var op        = require('object-path')
var md        = require('marked')
var crypto    = require('crypto')
var Promise   = require('promise')
// var Promise  = require('promise/lib/rejection-tracking').enable( {allRejections: true} )

LIMIT_PARALLEL = 3

function signData(data) {
    data = data || {}

    if (!APP_ENTU_USER || !APP_ENTU_KEY) { return data }

    var conditions = []
    for (k in data) {
        if (data.hasOwnProperty(k)) {
            conditions.push({k: data[k]})
        }
    }

    var expiration = new Date()
    expiration.setMinutes(expiration.getMinutes() + 10)

    data.user = APP_ENTU_USER
    var buffStr = JSON.stringify({expiration: expiration.toISOString(), conditions: conditions})
    data.policy = new Buffer(buffStr).toString('base64')
    data.signature = crypto.createHmac('sha1', APP_ENTU_KEY).update(data.policy).digest('base64')

    return data
}


//Get entity from Entu
function getEntity(id, authId, authToken) {
    return new Promise(function (fulfill, reject) {
        var headers = {}
        var qs = {}
        if (authId && authToken) {
            headers = {'X-Auth-UserId': authId, 'X-Auth-Token': authToken}
        } else {
            qs = signData()
        }

        // debug('getEntity: ' + APP_ENTU_URL + '/entity-' + id)
        request.get({url: APP_ENTU_URL + '/entity-' + id, headers: headers, qs: qs, strictSSL: true, json: true}, function(err, response, body) {
            if (err) {
                return reject(err)
            }
            if (response.statusCode !== 200) {
                debug('Not OK on get ' + id + ' - ' + response.statusCode)
                return reject({error: op.get(body, 'error', body), eID: id, status: response.statusCode})
            }
            if (!body.result) {
                debug('Body w/o result ' + response.statusCode)
                return reject(op.get(body, 'error', body))
            }
            if (body.error) {
                return reject(op.get(body, 'error', body))
            }
            var properties = op.get(body, 'result.properties', {})
            // debug( JSON.stringify(properties, null, 4) )
            var entity = {
                id: op.get(body, 'result.id', null),
                changedTs: new Date(op.get(body, 'result.changed', 0)).getTime() / 1e3,
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
                                created: op.get(properties, [p, 'values', v, 'created']),
                                'created_by': op.get(properties, [p, 'values', v, 'created_by']),
                                value: op.get(properties, [p, 'values', v, 'value']),
                                file: APP_ENTU_URL + '/file-' + op.get(properties, [p, 'values', v, 'db_value'])
                            })
                        } else if (op.get(properties, [p, 'datatype']) === 'text') {
                            op.push(entity, ['properties', p], {
                                id: op.get(properties, [p, 'values', v, 'id']),
                                created: op.get(properties, [p, 'values', v, 'created']),
                                'created_by': op.get(properties, [p, 'values', v, 'created_by']),
                                value: op.get(properties, [p, 'values', v, 'value']),
                                md: md(op.get(properties, [p, 'values', v, 'db_value']))
                            })
                        } else if (op.get(properties, [p, 'datatype']) === 'reference') {
                            op.push(entity, ['properties', p], {
                                id: op.get(properties, [p, 'values', v, 'id']),
                                created: op.get(properties, [p, 'values', v, 'created']),
                                'created_by': op.get(properties, [p, 'values', v, 'created_by']),
                                value: op.get(properties, [p, 'values', v, 'value']),
                                reference: op.get(properties, [p, 'values', v, 'db_value'])
                            })
                        } else {
                            op.push(entity, ['properties', p], {
                                id: op.get(properties, [p, 'values', v, 'id']),
                                created: op.get(properties, [p, 'values', v, 'created']),
                                'created_by': op.get(properties, [p, 'values', v, 'created_by']),
                                value: op.get(properties, [p, 'values', v, 'value']),
                            })
                        }
                    }
                    if (op.get(properties, [p, 'multiplicity']) === 1) { op.set(entity, ['properties', p], op.get(entity, ['properties', p, 0])) }
                }
            }
            // debug(JSON.stringify(entity, null, '  '))
            fulfill(op(entity))
        })
    })
}


//Get entities by definition
function getEntities(definition, limit, authId, authToken) {
    return new Promise(function (fulfill, reject) {
        if (!definition) { return reject(new Error('Missing "definition"')) }

        var qs = {definition: definition}
        var headers = {}
        if (limit) { qs.limit = limit }
        if (authId && authToken) {
            headers = {'X-Auth-UserId': authId, 'X-Auth-Token': authToken}
        } else {
            qs = signData(qs)
        }

        request.get({url: APP_ENTU_URL + '/entity', headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
            if (error) { return reject(error) }
            if (response.statusCode !== 200 || !body.result) { return reject(new Error(op.get(body, 'error', body))) }

            var entities = []
            async.eachSeries(op.get(body, 'result', []), function(e, callback) {
                getEntity(e.id, authId, authToken)
                .then(function(opEntity) {
                    entities.push(opEntity)
                    callback()
                })
            }, function(error) {
                if (error) { return reject(error) }
                // debug(definition + ' returned ' +  entities.length + ' entities.')
                fulfill(entities)
            })
        })
    })
}


//Get childs by parent entity id and optionally by definition
function getChilds(parentEid, definition, authId, authToken) {
    return new Promise(function (fulfill, reject) {
        if (!parentEid) { return reject(new Error('Missing "parentEid"')) }
        // debug('get childs for ' + parentEid)
        var qs = {}
        if (definition) { qs = {definition: definition} }
        var headers = {}
        if (authId && authToken) {
            headers = {'X-Auth-UserId': authId, 'X-Auth-Token': authToken}
        } else {
            qs = signData(qs)
        }
        var url = '/entity-' + parentEid + '/childs'
        // debug('getChilds: ' + url)
        var options = {
            url: APP_ENTU_URL + url,
            headers: headers,
            qs: qs,
            strictSSL: true,
            json: true
        }
        request.get(options, function(error, response, body) {
            if (error) { return reject(error) }
            if (response.statusCode !== 200 || !body.result) { return reject(new Error(op.get(body, 'error', body))) }
            // debug('getChilds response', response.statusCode)
            // debug(body)
            var definitions = Object.keys(body.result)
            var childs = []
            async.eachSeries(
                definitions,
                function doLoop(definition, doLoopCB) {
                    var loop = ['result', definition, 'entities']
                    async.each(op.get(body, loop, []), function(e, eachCB) {
                        getEntity(e.id, authId, authToken)
                        .then(function(childE) {
                            childE.set('_display', {name: e.name, info: e.info})
                            childs.push(childE)
                            eachCB()
                        })
                    }, function gotByDef(error) {
                        if (error) { return doLoopCB(error) }
                        doLoopCB(null)
                    })
                },
                function endLoop(error) {
                    if (error) { return reject(error) }
                    fulfill(childs)
                }
            )
        })
    })

}


//Edit entity
// params = {
//     entity_id: entity_id,
//     entity_definition: entity_definition,
//     dataproperty: dataproperty,
//     property_id: property_id,
//     new_value: new_value
// }
function edit(params) {
    var body = {}
    var property = params.entity_definition + '-' + params.dataproperty
    if (op.get(params, ['property_id'], false)) {
        property = property + '.' + params.property_id
    }
    body[property] = op.get(params, 'new_value', '')
    var headers = {}
    var qb = signData(body)
    return new Promise(function (fulfill, reject) {
        request.put(
            { url: APP_ENTU_URL + '/entity-' + params.entity_id, headers: headers, body: qb, strictSSL: true, json: true, timeout: 60000 },
            function(error, response, body) {
                if(error) { return reject(error) }
                if(response.statusCode !== 201 || !body.result) { return reject(new Error(op.get(body, 'error', body))) }
                fulfill(op.get(body, 'result.properties.' + property + '.0', null))
            }
        )
    })
}

//Add entity
function add(parentEid, definition, properties, authId, authToken) {
    var data = { definition: definition }

    for (p in properties) {
        if (properties.hasOwnProperty(p)) {
            data[definition + '-' + p] = properties[p]
        }
    }

    var headers = {}
    var qb = data
    if (authId && authToken) {
        headers = {'X-Auth-UserId': authId, 'X-Auth-Token': authToken}
    } else {
        qb = signData(data)
    }

    var options = {
        url: APP_ENTU_URL + '/entity-' + parentEid,
        headers: headers,
        body: qb,
        strictSSL: true,
        json: true
    }
    // debug(JSON.stringify(options, null, 4))
    return new Promise(function (fulfill, reject) {
        request.post(options, function(error, response, body) {
            if (error) { return reject(error) }
            if (response.statusCode !== 201 || !body.result) { return reject(new Error(op.get(body, 'error', body))) }
            fulfill(op.get(body, 'result.id', null))
        })
    })
}



// Poll Entu for updated entities
// options: {
//     definition: definition,
//     timestamp: unix_timestamp,
//     limit: limit
// }
// As of API2@2016-02-05, limit < 500, default 50
function pollUpdates(options, authId, authToken) {
    // debug('Polling from ' + APP_ENTU_URL + '/changed' + ' with ', JSON.stringify(options, null, 4))
    return new Promise(function (fulfill, reject) {
        var qs = {}
        op.set(qs, ['limit'], op.get(options, ['limit'], 50))
        if (options.definition) { qs.definition = options.definition }
        if (options.timestamp) { qs.timestamp = options.timestamp }

        var headers = {}
        if (authId && authToken) {
            headers = {'X-Auth-UserId': authId, 'X-Auth-Token': authToken}
        } else {
            qs = signData(qs)
        }

        request.get({url: APP_ENTU_URL + '/changed', headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
            if (error) { return reject(error) }
            if (response.statusCode !== 200 || !body.result) { return reject(new Error(op.get(body, 'error', body))) }
            fulfill(op.get(body, 'result', []))
        })
    })
}



function pollParents(id, authId, authToken) {
    var requestUrl = APP_ENTU_URL + '/entity-' + id + '/parents'
    // debug('Checking for parents of ' + id + ' from ' + requestUrl)
    return new Promise(function (fulfill, reject) {
        var headers = {}
        var qs = {}
        if (authId && authToken) {
            headers = {'X-Auth-UserId': authId, 'X-Auth-Token': authToken}
        } else {
            qs = signData()
        }
        request.get({url: requestUrl, headers: headers, qs: qs, strictSSL: true, json: true}, function(error, response, body) {
            if (error) { return reject(error) }
            if (response.statusCode !== 200 || !body.result) { return reject(new Error(op.get(body, 'error', body))) }
            fulfill(op.get(body, 'result', []))
        })
    })
}



module.exports = {
    pollUpdates: pollUpdates,
    getEntity: getEntity,
    getChilds: getChilds,
    getEntities: getEntities,
    pollParents: pollParents,
    edit: edit,
    add: add
}
// exports.rights          = rights
