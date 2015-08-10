var fs      = require('fs')
var express = require('express')
var router  = express.Router()
var path    = require('path')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async   = require('async')
var op      = require('object-path')

var entu    = require('./entu')



// GET home page
router.get('/', function(req, res, next) {
    debug('Loading "' + req.url + '"')

    var page_eid = WWW_ROOT_EID

    if (req.query['page']) {
        // debug(req.query['page'])
        page_eid = req.query['page']
    }
    // debug(req.query())

    var root_entity = op(require('../pagecache/' + WWW_ROOT_EID + '.json'))
    var page_entity = op(require('../pagecache/' + page_eid + '.json'))

    var async_tasks = []
    async_tasks.push(function(callback) {
        debug('read root')
        // debug(JSON.stringify(root_entity.get('child_ids'), null, '  '))
        var root_childs = []
        async.each(root_entity.get('child_ids'),
            function(child_id, callback) {
                root_childs.push(op(require('../pagecache/' + child_id + '.json')))
                callback()
            },
            function(error) {
                if(error) {
                    debug(error)
                }
                root_entity.set('childs', root_childs)
                // debug('read root done', root_entity.get('_display'))
                // debug('read root done', root_entity.get('_childs')[0].get('_display'))
                callback()
                // debug(JSON.stringify(root_entity.get(), null, '  '))
            }
        )
    })
    if (page_eid != WWW_ROOT_EID) {
        async_tasks.push(function(callback) {
            debug('read page')
            var page_childs = []
            async.each(page_entity.get('child_ids'),
                function(child_id, callback) {
                    page_childs.push(op(require('../pagecache/' + child_id + '.json')))
                    callback(null)
                },
                function(error) {
                    if(error) {
                        debug(error)
                    }
                    page_entity.set('childs', page_childs)
                    callback()
                }
            )
        })
    }

    async.parallel(async_tasks, function done() {
        // res.end('readyzzz!')
        res.render('e_' + page_eid, {
            root: root_entity,
            page: page_entity
        }, function(error, data) {
            // debug('finished', data)
            if (error) {
                debug(error)
            }
            res.end(data)
            debug('Rendered ' + 'e_' + page_eid)
        })
    })
})


module.exports = router
