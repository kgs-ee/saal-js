var fs = require('fs')
var path = require('path')

var chokidar = require('chokidar')

var cache_dir = path.join(__dirname, 'pagecache')
var watched_files = ['local_entities.json', 'relationships.json', 'root.json']
var log = console.log.bind(console)

var watcher = chokidar.watch(cache_dir, {
  ignored: /[\/\\]\./,
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 450
  }
}).on('change', _path => {
  let _filename = path.basename(_path)
  if (watched_files.indexOf(_filename) !== -1) {
    log(`File ${path.basename(_path)} has been changed`)
  } else if (_filename === 'lastPollTs.json') {
    log(`File ${path.basename(_path)} has been changed to ${fs.readFileSync(_path)}`)
  }
})
