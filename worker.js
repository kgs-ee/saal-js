if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var path    = require('path')
var fs      = require('fs')
var logger  = require('morgan')
var rotator = require('file-stream-rotator')
var stylus  = require('stylus')
var favicon = require('serve-favicon')
var cookie  = require('cookie-parser')
var random  = require('randomstring')
var bparser = require('body-parser')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var op      = require('object-path')
var raven   = require('raven')


var i18n    = require('./helpers/i18n')


debug('Loading Entu web ...')

if (!process.env.ENTU_USER) {
    throw '"ENTU_USER" missing in environment'
}
// global variables (and list of all used environment variables)
APP_VERSION         = process.env.VERSION || require('./package').version
APP_ENTU_ROOT       = 1 // institution
APP_ROOT_REFRESH_MS = 30 * 60 * 1000
APP_DEBUG           = process.env.DEBUG
APP_PORT            = process.env.PORT || 3000
APP_LOG_DIR         = process.env.LOGDIR || __dirname + '/log'
APP_CACHE_DIR       = __dirname + '/pagecache'
APP_COOKIE_SECRET   = process.env.COOKIE_SECRET || random.generate(16)
APP_ENTU_URL        = process.env.ENTU_URL || "https://saal.entu.ee/api2"
APP_ENTU_USER       = process.env.ENTU_USER
APP_ENTU_KEY        = process.env.ENTU_KEY

// Index and cache for entities and relationshipd

// console.log(process.env)

// ensure required directories
fs.existsSync(APP_LOG_DIR) || fs.mkdirSync(APP_LOG_DIR)
fs.existsSync(APP_CACHE_DIR) || fs.mkdirSync(APP_CACHE_DIR)

// Site data cache
SDC = op({
    "root": {},
    "local_entities": {},
    "relationships": {},
})
// require('./helpers/maintenance')
require('./helpers/cache')


// create a rotating write stream
var access_log_stream = rotator.getStream({
  filename: APP_LOG_DIR + '/access-%DATE%.log',
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
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

    // logging
    .use(logger(':date[iso] | HTTP/:http-version | :method | :status | :url | :res[content-length] b | :response-time ms | :remote-addr | :referrer | :user-agent', {stream: access_log_stream}))

    // set defaults for views
    .use(function(req, res, next) {
        if(req.path === '/') return res.redirect('/et/')
        // debug(JSON.stringify(req.path, null, '    '))
        // res.locals.lang = 'et'
        res.locals.op = op
        res.locals.SAAL = SDC.get('root')
        var p = req.path.split('/')
        p.shift()
        p.shift()
        res.locals.path = p.join('/')
        if(req.signedCookies.auth_id && req.signedCookies.auth_token) {
            res.locals.user = {
                id: req.signedCookies.auth_id,
                token: req.signedCookies.auth_token
            }
        }
        next(null)
    })

    //Initiate i18n
    app.use(i18n.init)

    .locals
        .moment = require('moment');


app

    // routes mapping
    .use('/:lang',               require('./routes/index'))
    .use('/:lang/about/',        require('./routes/about'))
    .use('/:lang/dev/',          require('./routes/dev'))
    .use('/:lang/performance/',  require('./routes/performance'))
    .use('/:lang/tours/',        require('./routes/tours'))
    .use('/:lang/program/',      require('./routes/program'))
    .use('/:lang/residency/',    require('./routes/residency'))
    .use('/:lang/resident/',     require('./routes/resident'))
    .use('/:lang/projects/',     require('./routes/projects'))
    .use('/:lang/contact/',      require('./routes/contact'))
    .use('/:lang/search',        require('./routes/search'))
    .use('/:lang/signin',        require('./routes/signin'))
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
