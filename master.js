if (process.env.NEW_RELIC_LICENSE_KEY) { require('newrelic') }

require('./helpers/setenv.js')

var path = require('path')
var debug = require('debug')('app:' + path.basename(__filename).replace('.js', ''))

var async = require('async')
var bparser = require('body-parser')
var chokidar = require('chokidar')
var cookie = require('cookie-parser')
var express = require('express')
var fs = require('fs')
var i18n = require('./helpers/i18n')
var moment = require('moment')
var op = require('object-path')
var raven = require('raven')



// initialize getsentry.com client
var ravenClient = new raven.Client({ release: APP_VERSION })

// debug(APP_ENTU_OPTIONS)

debug('Loading Entu web ...')

SDC = op({})

var prepareControllersFa = []

function loadCache (callback) {
  var filenames = fs.readdirSync(APP_CACHE_DIR).map(function (filename) {
    return filename.split('.json')[0]
  })

  async.each(filenames, function (filename, callback) {
    // debug({ cmd: 'log', log: 'Loading cache from ' + filename })
    // debug(filename)
    // debug('Loading: ', path.join(APP_CACHE_DIR, filename))
    fs.readFile(path.join(APP_CACHE_DIR, filename + '.json'), function (err, data) {
      if (err) {
        debug('Not loaded: ', path.join(APP_CACHE_DIR, filename), err)
        return callback(err)
      }
      debug('filename', filename)
      try {
        SDC.set(filename, JSON.parse(data))
      } catch (e) {
        console.log('e', e)
        SDC.set(filename, data)
      }
      // debug('Loaded: ', path.join(APP_CACHE_DIR, filename))
      return callback()
    })
  }, function (err) {
    if (err) {
      debug('Failed to load local cache.', err)
      debug({ cmd: 'log', log: 'Failed to load local cache.', err: err })
      return callback(err)
    }
    // debug({ cmd: 'log', log: 'Cache loaded.' })
    // debug('Cache loaded.')
    return callback()
  })
}

function prepareControllers (prepareControllersCB) {
  debug('Preparing data for controllers.')
  var controllers = fs.readdirSync(path.join(__dirname, 'routes')).map(function (filename) {
    return filename.split('.js')[0]
  })
  async.eachSeries(controllers, function (controller, callback) {
    // debug('controller:', controller)
    var cntrl = require(path.join(__dirname, 'routes', controller))
    if (cntrl.prepare !== undefined) {
      // debug({ cmd: 'log', log: 'Preparing ' + controller })
      cntrl.prepare(function () {
        // debug({ cmd: 'log', log: 'Callback from ' + controller })
        return callback()
      })
    } else {
      // debug({ cmd: 'log', log: 'Not preparing ' + controller })
      return callback()
    }
  }, function (err) {
    if (err) {
      // debug('Failed to prepare controllers.', err)
      debug({ cmd: 'log', log: 'Failed to prepare controllers.', err: err })
      prepareControllersCB(err)
      return
    }
    // debug({ cmd: 'log', log: 'Controllers prepared.' })
    debug('Controllers prepared.')
    prepareControllersCB()
  })
}

// Configure i18n
i18n.configure({
  locales: ['en', 'et'],
  defaultLocale: 'et',
  redirectWrongLocale: true,
  file: path.join(__dirname, 'localization', 'locales.yaml'),
  updateFile: true
})

// initialize getsentry.com client
var ravenClient = new raven.Client({
  release: APP_VERSION,
  dataCallback: function (data) {
    // debug(JSON.stringify({data: data}, null, 4))
    // delete data.request.env
    return data
  }
})

var app = express()
debug('Start jade engine')
app
  // jade view engine
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'jade')

debug('Start getsentry logs')
app
  // logs to getsentry.com - start
  .use(raven.middleware.express.requestHandler(ravenClient))

debug('Cookies')
app
  // cookies
  .use(cookie(APP_COOKIE_SECRET))

debug('Body parser')
app
  // parse POST requests
  .use(bparser.json())
  .use(bparser.urlencoded({extended: true}))

debug('Static and favicon')
app
  // static files path & favicon
  .use(express.static(path.join(__dirname, 'public')))
  // .use(favicon(path.join(__dirname, 'public', 'images', 'kgs-logo.ico')))

  // set defaults for views
  .use(function (req, res, next) {
    if (req.path === '/') { return res.redirect('/et/') }
    // hard links
    if (Object.keys(REDIRECTS).indexOf(req.path) !== -1) {
      return res.redirect(REDIRECTS[req.path]) 
    }
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
    if (req.signedCookies.auth_id && req.signedCookies.auth_token) {
      res.locals.user = {
        id: req.signedCookies.auth_id,
        token: req.signedCookies.auth_token
      }
    }
    next(null)
  })

  // Initiate i18n
  .use(i18n.init)

app
  // routes mapping
  .use('/:lang', require('./routes/index'))
  .use('/:lang/about/', require('./routes/about'))
  .use('/:lang/performance/', require('./routes/performance'))
  .use('/:lang/tours/', require('./routes/tours'))
  .use('/:lang/program/', require('./routes/program'))
  .use('/:lang/co_productions/', require('./routes/co_productions'))
  .use('/:lang/residency/', require('./routes/residency'))
  .use('/:lang/resident/', require('./routes/resident'))
  .use('/:lang/projects/', require('./routes/projects'))
  .use('/:lang/contact/', require('./routes/contact'))
  .use('/:lang/magazine/', require('./routes/magazine'))
  // .use('/:lang/search', require('./routes/search'))
  // .use('/:lang/signin',        require('./routes/signin'))
  .use('/:lang/festivals', require('./routes/festivals'))
  .use('/:lang/festival', require('./routes/festival'))
  .use('/:lang/calendar_json', require('./routes/calendar_json'))

  // logs to getsentry.com - error
  .use(raven.middleware.express.errorHandler(ravenClient))

  // 404
  .use(function (req, res, next) {
    console.log(new Date(), '404:' + req.path)
    return res.redirect('/')

  // var err = new Error('Not Found')
  // err.status = 404
  // next(err)
  })

  // error
  .use(function (err, req, res) {
    var status = parseInt(err.status, 10) || 500

    res.status(status)
    res.render('error', {
      title: status,
      message: res.locals.t('error.' + err.message),
      error: APP_DEBUG ? err : {}
    })

    if (err.status !== 404) { debug(err) }
  })

  // start server
  .listen(APP_PORT)

debug('Started at port %s', APP_PORT)



var watched_files = ['local_entities.json', 'relationships.json', 'root.json']
var watcher = chokidar.watch(APP_CACHE_DIR, {
  ignored: /[\/\\]\./,
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 450
  }
}).on('change', _path => {
  let _filename = path.basename(_path)
  if (watched_files.indexOf(_filename) !== -1) {
    fs.readFile(_path, function (err, data) {
      if (err) {
        debug('Not loaded: ', _path, err)
        return
      }
      let _sdcname = _filename.slice(0, -5)
      debug('filename', _sdcname)
      try {
        SDC.set(_sdcname, JSON.parse(data))
      } catch (e) {
        debug('ERR:', e)
        SDC.set(_sdcname, data)
      }
      debug('Loaded: ', path.join(APP_CACHE_DIR, _sdcname))

      prepareControllers(function (err) {
        if (err) {
          debug('ERR:', err)
          return
        }
        debug('Controllers prepped 2.')
      })
    })
  } else if (_filename === 'lastPollTs.json') {
    debug('Poll TS:', fs.readFileSync(_path))
  }
})

loadCache(function() {
  debug('1st run. Load cache.')
  prepareControllers(function (err) {
    debug('1st run. Prepping controllers.')
    if (err) {
      debug('ERR:', err)
      return
    }
    debug('Controllers prepped 1.')
  })
})
