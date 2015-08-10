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

debug('Loading Entu web ...')


// global variables (and list of all used environment variables)
APP_DEBUG     = process.env.DEBUG
APP_PORT      = process.env.PORT || 3000
APP_LOG_DIR   = process.env.LOGDIR || __dirname + '/log'
APP_COOKIE_SECRET = process.env.COOKIE_SECRET || random.generate(16)
APP_ENTU_URL  = process.env.ENTU_URL
if (!process.env.ENTU_URL) throw '"ENTU_URL" missing in environment'
WWW_ROOT_EID  = process.env.WWW_ROOT_EID
if (!process.env.WWW_ROOT_EID) throw '"WWW_ROOT_EID" missing in environment'
APP_ENTU_USER = process.env.ENTU_USER
APP_ENTU_KEY  = process.env.ENTU_KEY

console.log(process.env)

require('./maintenance')

// ensure log directory exists
fs.existsSync(APP_LOG_DIR) || fs.mkdirSync(APP_LOG_DIR)



// create a rotating write stream
var access_log_stream = rotator.getStream({
  filename: APP_LOG_DIR + '/access-%DATE%.log',
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
})



express()
    // jade view engine
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'jade')

    // cookies
    .use(cookie(APP_COOKIE_SECRET))

    // parse POST requests
    .use(bparser.json())
    .use(bparser.urlencoded({extended: true}))

    // stylus to css converter
    .use(stylus.middleware({src: path.join(__dirname, 'public'), compress: true}))

    // static files path & favicon
    .use(express.static(path.join(__dirname, 'public')))
    .use(favicon(path.join(__dirname, 'public', 'images', 'logo.ico')))

    // logging
    .use(logger(':date[iso] | HTTP/:http-version | :method | :status | :url | :res[content-length] b | :response-time ms | :remote-addr | :referrer | :user-agent', {stream: access_log_stream}))

    // set defaults for views
    .use(function(req, res, next) {
        if(req.signedCookies.auth_id && req.signedCookies.auth_token) {
            res.locals.user = {
                id: req.signedCookies.auth_id,
                token: req.signedCookies.auth_token
            }
        }
        next(null)
    })

    // routes mapping
    .use('/',       require('./routes/index'))
    .use('/users',  require('./routes/users'))
    .use('/help',   require('./routes/help'))
    .use('/signin', require('./routes/signin'))

    // 404
    .use(function(req, res, next) {
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
            message: err.message,
            error: APP_DEBUG ? err : {}
        })

        if(err.status !== 404) debug(err)
    })

    // start server
    .listen(APP_PORT)



debug('Started at port %s', APP_PORT)
