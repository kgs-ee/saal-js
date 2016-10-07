var fs = require('fs')
var random = require('randomstring')
var path = require('path')

APP_ROOT_DIR = path.join(__dirname, '..')

APP_ROOT_REFRESH_MS = 30 * 60 * 1000
APP_COOKIE_SECRET = random.generate(16)
APP_DEPLOYMENT = process.env.DEPLOYMENT
APP_VERSION = require(path.join(APP_ROOT_DIR, 'package.json')).version
APP_DEBUG = process.env.DEBUG
APP_PORT = process.env.PORT || 3000
ENTU_POLL_SEC = process.env.ENTU_POLL_SEC * 1e3 || 10e3

APP_ENTU_OPTIONS = {
  entuUrl: process.env.ENTU_URL || 'https://saal.entu.ee',
  user: process.env.ENTU_USER,
  key: process.env.ENTU_KEY
}

// Site data cache
APP_ENTU_ROOT = 1 // institution
APP_CACHE_DIR = path.join(APP_ROOT_DIR, '..', 'www_cache')
if (!fs.existsSync(APP_CACHE_DIR)) { fs.mkdirSync(APP_CACHE_DIR) }

if (!process.env.ENTU_USER) {
  throw '"ENTU_USER" missing in environment'
}
if (!process.env.ENTU_KEY) {
  throw '"ENTU_KEY" missing in environment'
}

REDIRECTS = {
  '/NUPerformanceFestival': '/et/festival/1933',
  '/nuperformancefestival': '/et/festival/1933',
  '/SAALBiennaal': '/et/festival/4054',
  '/saalbiennaal': '/et/festival/4054'
}

console.log('\n\nEnv loaded for', APP_ROOT_DIR, APP_VERSION)
