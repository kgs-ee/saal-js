if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var path    = require('path')
var fs      = require('fs')
var logger  = require('morgan')
var rotator = require('file-stream-rotator')
var stylus  = require('stylus')
var favicon = require('serve-favicon')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))



// global variables (and list of all used environment variables)
APP_DEBUG    = process.env.DEBUG
APP_PORT     = process.env.PORT || 3000
APP_LOG_DIR  = process.env.LOGDIR || __dirname + '/log'
APP_ENTU_URL = process.env.ENTU || 'https://saal.entu.ee/api2'



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

    // stylus to css converter
    .use(stylus.middleware({src: path.join(__dirname, 'public'), compress: true}))

    // static files path & favicon
    .use(express.static(path.join(__dirname, 'public')))
    .use(favicon(path.join(__dirname, 'public', 'images', 'kgs-logo.ico')))

    // logging
    .use(logger(':date[iso] | HTTP/:http-version | :method | :status | :url | :res[content-length] b | :response-time ms | :remote-addr | :referrer | :user-agent', {stream: access_log_stream}))

    // routes mapping
    .use('/',         require('./routes/index'))
    .use('/profiles', require('./routes/profiles'))

    // 404
    .use(function(req, res, next) {
        var err = new Error('Not Found')
        err.status = 404
        next(err)
    })

    // error
    .use(function(err, req, res, next) {
        res.status(err.status || 500)
        res.render('error', {
            title: err.status,
            message: err.message,
            error: APP_DEBUG ? err : {}
        })
        if(err.status !== 404) debug(err)
    })

    // start server
    .listen(APP_PORT)
    console.log('Listening on ' + APP_PORT)



debug('Started at port %s', APP_PORT)
