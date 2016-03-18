var cluster  = require('cluster')
var cpuCount = require('os').cpus().length
var fs       = require('fs')
// var op       = require('object-path')
var path     = require('path')
var debug    = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var random   = require('randomstring')


APP_ROOT_REFRESH_MS = 30 * 60 * 1000
APP_COOKIE_SECRET   = process.env.COOKIE_SECRET || random.generate(16)
APP_DEPLOYMENT      = process.env.DEPLOYMENT

if (!process.env.ENTU_USER) {
    throw '"ENTU_USER" missing in environment'
}
if (!process.env.ENTU_KEY) {
    throw '"ENTU_KEY" missing in environment'
}

APP_ENTU_OPTIONS    = {
    entuUrl: process.env.ENTU_URL || 'https://saal.entu.ee',
    user: process.env.ENTU_USER,
    key: process.env.ENTU_KEY
}

// Site data cache
APP_ENTU_ROOT       = 1 // institution
APP_CACHE_DIR       = __dirname + '/pagecache'
if (!fs.existsSync(APP_CACHE_DIR)) { fs.mkdirSync(APP_CACHE_DIR) }

var workers = []

// debug(APP_ENTU_OPTIONS)
var cache = require('./helpers/cache')
cache.sync(function cacheSyncCB() {
    for (var i in workers) {
        if (workers.hasOwnProperty(i)) {
            var worker = workers[i]
            if (worker) {
                console.log('cacheSyncCB: Reload worker ' + worker.id)
                worker.send({ cmd: 'reload', dir: APP_CACHE_DIR })
            }
        }
    }
})

debug('Check if PL sync', APP_DEPLOYMENT)
if (APP_DEPLOYMENT === 'live' || APP_DEPLOYMENT === 'dev') {
    debug('Initialising PL sync')
    var plSync = require('./helpers/pl-sync')
    function startPLSync() {
        if (plSync.state === undefined) {
            debug('PLSync not ready, try in a sec')
            setTimeout(function () {
                startPLSync()
            }, 1000)
        } else if (plSync.state === 'idle') {
            plSync.routine(function plSyncCB(err, message) {
                if (err) {
                    console.log(err)
                    console.log(message)
                    throw 'PL sync totally messed up'
                }
                console.log(message + ' at ' + Date().toString())
            })
        }
    }
    startPLSync()
}


// Broadcast a message to all other workers
function broadcast(data, workerId) {
    if (!workerId) {
        workerId = -1
    }
    console.log('Broadcast from ' + workerId + '.')
    for (var i in workers) {
        if (workers.hasOwnProperty(i)) {
            var worker = workers[i]
            if (worker && worker.id !== workerId) {
                worker.send({ cmd: 'data', data: data, from: workerId, chat: 'broadcast to ' + worker.id + ' initiated by ' + workerId })
            }
        }
    }
}


function createWorker() {
    var worker = cluster.fork()
    worker.on('message', function(msg) {
        if (msg.cmd) {
            switch (msg.cmd) {
                case 'log':
                    console.log(new Date().toString() + ' W-' + this.id + ': ' + msg.log)
                break
                case 'broadcast':
                    console.log('W-' + this.id + ' broadcasting...')
                    broadcast(msg.data, this.id)
                break
            }
        }
        if (msg.err) {
            console.log(JSON.stringify({worker: this.id, error: err}, null, 2))
        }
    })
    // Add the worker to an array of known workers
    workers[worker.id] = worker
}

cluster.setupMaster({ exec: path.join(__dirname, 'worker.js') })

if (cluster.isMaster) {
    // Create a worker for each CPU
    cpuCount = 1
    for (var i = 0; i < cpuCount; i += 1) {
        createWorker()
    }

    // Listen for new workers
    cluster.on('online', function(worker) {
        console.log(new Date().toString() + ' worker ' + worker.id + ' started')
        worker.send({ cmd: 'APP_COOKIE_SECRET', APP_COOKIE_SECRET: APP_COOKIE_SECRET })
        worker.send({ cmd: 'reload', dir: APP_CACHE_DIR })
    })

    // Listen for dying workers nad replace the dead worker, we're not sentimental
    cluster.on('exit', function(worker, code, signal) {
        workers[worker.id] = false
        if(signal) {
            console.error('Worker #' + worker.id + ' was killed by signal: ' + signal)
        } else if(code !== 0) {
            console.error('Worker #' + worker.id + ' exited with error code: ' + code)
        } else {
            console.error('Worker #' + worker.id + ' success!')
        }
        createWorker()
    })
}
