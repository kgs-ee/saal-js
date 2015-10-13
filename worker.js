if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var async    = require('async')
var bparser  = require('body-parser')
var cookie   = require('cookie-parser')
var path     = require('path')
var debug    = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var express  = require('express')
var favicon  = require('serve-favicon')
var fs       = require('fs')
var moment   = require('moment')
var op       = require('object-path')
var raven    = require('raven')
var stylus   = require('stylus')

var i18n     = require('./helpers/i18n')

debug('Loading Entu web ...')

if (!process.env.ENTU_USER) {
    throw '"ENTU_USER" missing in environment'
}
APP_COOKIE_SECRET   = '' // Will be set from master
APP_CACHE_DIR       = '' // Will be set from master
APP_VERSION         = process.env.VERSION || require('./package').version
APP_DEBUG           = process.env.DEBUG
APP_PORT            = process.env.PORT || 3000


SDC = op({})

var prepare_controllers_fa = []

prepare_controllers_fa.push(function loadCache(callback) {
    var filenames = fs.readdirSync(APP_CACHE_DIR).map(function(filename) {
        return filename.split('.json')[0]
    })

    async.each(filenames, function(filename, callback) {
        // process.send({ cmd: 'log', log: 'Loading cache from ' + filename })
        // debug(filename)
        try {
            SDC.set(filename, require(path.join(APP_CACHE_DIR, filename)))
        } catch(err) {
            debug('Not loaded: ', filename)
            op.del(filenames, filenames.indexOf(filename))
        }
        callback()
    }, function(err) {
        if (err) {
            debug('Failed to load local cache.', err)
            process.send({ cmd: 'log', log: 'Failed to load local cache.', err: err })
            callback(err)
            return
        }
        // process.send({ cmd: 'log', log: 'Cache loaded.' })
        // debug('Cache loaded.')
        callback()
    })
})

prepare_controllers_fa.push(function prepareControllers(callback) {
    // process.send({ cmd: 'log', log: 'Preparing data for controllers.' })
    // debug('Preparing data for controllers.')
    var controllers = fs.readdirSync(path.join(__dirname, 'routes')).map(function(filename) {
        return filename.split('.js')[0]
    })
    async.each(controllers, function(controller, callback) {
        var c = require(path.join(__dirname, 'routes', controller))
        if (c.prepare !== undefined) {
            // debug('Preparing ' + controller)
            c.prepare(callback)
        } else {
            callback()
        }
    }, function(err) {
        if (err) {
            // debug('Failed to prepare controllers.', err)
            process.send({ cmd: 'log', log: 'Failed to prepare controllers.', err: err })
            callback(err)
            return
        }
        // process.send({ cmd: 'log', log: 'Controllers prepared.' })
        // debug('Controllers prepared.')
        callback()
    })
})


// React to messages received from master
process.on('message', function(msg) {
    switch(msg.cmd) {
        case 'APP_COOKIE_SECRET':
            APP_COOKIE_SECRET = msg.APP_COOKIE_SECRET
        break
        case 'reload':
            APP_CACHE_DIR = msg.dir
            // process.send({ cmd: 'log', log: 'Loading cache from ' + APP_CACHE_DIR })
            // debug('Loading local cache')

            async.series(prepare_controllers_fa, function routineFinally(err) {
                if (err) {
                    process.send({ cmd: 'log', log: 'Reload failed', err: err })
                    // debug('Reload failed', err)
                    return
                }
                process.send({ cmd: 'log', log: 'Worker reloaded' })
            })
        break
    }
})


// Configure i18n
i18n.configure({
    locales: ['en', 'et'],
    defaultLocale: 'et',
    redirectWrongLocale: true,
    file: path.join(__dirname, 'localization', 'locales.yaml'),
    updateFile: true
})


// initialize getsentry.com client
var raven_client = new raven.Client({
    release: APP_VERSION,
    dataCallback: function(data) {
        delete data.request.env
        return data
    }
})


var app     = express()

app
    // jade view engine
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'jade')

    // logs to getsentry.com - start
    .use(raven.middleware.express.requestHandler(raven_client))

    // cookies
    .use(cookie(APP_COOKIE_SECRET))

    // parse POST requests
    .use(bparser.json())
    .use(bparser.urlencoded({extended: true}))

    // stylus to css converter
    .use(stylus.middleware({src: path.join(__dirname, 'public'), compress: true}))

    // static files path & favicon
    .use(express.static(path.join(__dirname, 'public')))
    .use(favicon(path.join(__dirname, 'public', 'images', 'kgs-logo.ico')))

    // set defaults for views
    .use(function(req, res, next) {
        if(req.path === '/') return res.redirect('/et/')
        // debug(JSON.stringify(req.path, null, '    '))
        // res.locals.lang = 'et'
        res.locals.moment = moment
        res.locals.op = op
        res.locals.SAAL = SDC.get('root')
        var p = req.path.split('/')
        p.shift()
        p.shift()
        res.locals.path = p.join('/')
        res.locals.route = p[0]
        if(req.signedCookies.auth_id && req.signedCookies.auth_token) {
            res.locals.user = {
                id: req.signedCookies.auth_id,
                token: req.signedCookies.auth_token
            }
        }
        next(null)
    })

    //Initiate i18n
    .use(i18n.init)



app

    // routes mapping
    .use('/:lang',               require('./routes/index'))
    .use('/:lang/about/',        require('./routes/about'))
    .use('/:lang/dev/',          require('./routes/dev'))
    .use('/:lang/performance/',  require('./routes/performance'))
    .use('/:lang/tours/',        require('./routes/tours'))
    .use('/:lang/program/',      require('./routes/program'))
    .use('/:lang/co_productions/',      require('./routes/co_productions'))
    .use('/:lang/residency/',    require('./routes/residency'))
    .use('/:lang/resident/',     require('./routes/resident'))
    .use('/:lang/projects/',     require('./routes/projects'))
    .use('/:lang/contact/',      require('./routes/contact'))
    .use('/:lang/search',        require('./routes/search'))
    .use('/:lang/signin',        require('./routes/signin'))
    .use('/:lang/festival',      require('./routes/festival'))
    .use('/:lang/calendar_json', require('./routes/calendar_json'))

    // logs to getsentry.com - error
    .use(raven.middleware.express.errorHandler(raven_client))

    // 404
    .use(function(req, res, next) {
        debug('404:' + req.path)
        var err = new Error('Not Found')
        err.status = 404
        next(err)
    })

    // error
    .use(function(err, req, res, next) {
        var status = parseInt(err.status) || 500

        res.status(status)
        res.render('error', {
            title: status,
            message: res.locals.t('error.' + err.message),
            error: APP_DEBUG ? err : {}
        })

        if(err.status !== 404) debug(err)
    })

    // start server
    .listen(APP_PORT)



debug('Started at port %s', APP_PORT)
