require('./setenv.js')

var path      = require('path')
var debug     = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var async     = require('async')
var op        = require('object-path')
var fs        = require('fs')


var entu      = require('entulib')


CACHE_LOADED_MESSAGE = 'Cache successfully loaded'
CACHE_RELOAD_REQUIRED_MESSAGE = 'Full cache reload required'

var state = 'idle'

SDC = op({
  'root': {},
  'local_entities': {},
  'relationships': {},
  'lastPollTs': new Date().getTime()/1e3
})

var cacheFromEntu = [
  {'parent':'3808', 'definition': 'category',    'class': 'rootCategory'},
  {'parent':'1930', 'definition': 'event',       'class': 'festival'},
  {'parent':'1930', 'definition': 'performance', 'class': 'festival'},
  {'parent':'597',  'definition': 'event',       'class': 'program'},
  {'parent':'4054', 'definition': 'event',       'class': 'program'},
  {'parent':'1931', 'definition': 'event',       'class': 'residency'},
  {'parent':'1929', 'definition': 'event',       'class': 'tour'},
  {'parent':'1953', 'definition': 'news',        'class': 'news'},
  // {'parent':'1933', 'definition': 'coverage',    'class': 'coverage'}, // nu performance 2016
  {'parent':'4054', 'definition': 'coverage',    'class': 'coverage'}, // SB 2017
  {'parent':'4051', 'definition': 'person',      'class': 'team'},
  {'parent':'1935', 'definition': 'performance', 'class': 'performance'},
  {'parent':'2109', 'definition': 'location',    'class': 'location'},
  {'parent':'2107', 'definition': 'event',       'class': 'project'},
  {'parent':'1',    'definition': 'banner',      'class': 'supporters'},
  {'parent':'2786', 'definition': 'banner-type', 'class': 'banner types'},
  {'parent':'4024', 'definition': 'echo',        'class': 'echo'},
  {'parent':'4024', 'definition': 'category',    'class': 'echoCategory'},
]

// var tempLocalEntities = {}
// var tempRelationships = {}

var cacheSeries = []

process.on('unhandledRejection', function(err, promise) {
  console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
});


// Preload with stored data
cacheSeries.push(function loadCache(callback) {
  state = 'busy'
  debug('Loading local cache at ' + Date().toString())
  var mandatoryFilenames = Object.keys(SDC.get())
  var existingFilenames = fs.readdirSync(APP_CACHE_DIR).map(function(filename) {
    debug('Existing cache files: ', APP_CACHE_DIR, filename.split('.json')[0])
    return filename.split('.json')[0]
  })
  var filenames = existingFilenames.concat(mandatoryFilenames.filter(function(item) {
    return existingFilenames.indexOf(item) < 0
  }))

  async.each(filenames, function(filename, callback) {
    try {
      SDC.set(filename, require(path.join(APP_CACHE_DIR, filename)))
    } catch(err) {
      debug('Missing ' + filename + ' - ' + CACHE_RELOAD_REQUIRED_MESSAGE)
      return callback(CACHE_RELOAD_REQUIRED_MESSAGE)
    }
    callback()
  }, function(err) {
    if (err === CACHE_RELOAD_REQUIRED_MESSAGE) { return callback() }
    if (err) { throw err }
    // debug('Cache loaded.')
    callback(CACHE_LOADED_MESSAGE)
  })
})


// Cache root elements
cacheSeries.push(function cacheRoot(callback) {
  // debug('Caching root at ' + Date().toString())
  // debug('Caching root with ', APP_ENTU_OPTIONS)
  SDC.set(['root', 'season'], (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2) + '/' + (new Date().getFullYear()-2000+(Math.sign(new Date().getMonth()-7.5)-1)/2+1))
  entu.getEntity(APP_ENTU_ROOT, APP_ENTU_OPTIONS)
  .then(function(institution) {
    SDC.set(['root', 'main_color'],      institution.get(['properties', 'main-color',       0, 'value']))
    SDC.set(['root', 'secondary_color'], institution.get(['properties', 'secondary-color',  0, 'value']))
    SDC.set(['root', 'et-description'],     institution.get(['properties', 'et-description',      0, 'md']))
    SDC.set(['root', 'en-description'],     institution.get(['properties', 'en-description',      0, 'md']))
    SDC.set(['root', 'gallery'],         institution.get(['properties', 'photo']))
    // debug('Caching root success: ', institution.get())
    return callback(null)
  })
  .catch(function(reason) {
    debug('Caching root failed: ', reason)
    return callback(reason)
  })
})


function myProcessEntities(parentEid, eClass, definition, entities, callback) {
  function add2cache(entity, eClass) {
    SDC.set(['local_entities', 'by_eid', String(entity.id)], entity)
    if (eClass) {
      SDC.set(['local_entities', 'by_class', eClass, String(entity.id)], entity)
    }
    SDC.set(['local_entities', 'by_definition', entity.definition, String(entity.id)], entity)

    if (op.get(entity, ['properties', 'featured', 0, 'value']) === 'True' &&
      op.get(entity, ['definition']) === 'performance') {
      SDC.set(['local_entities', 'featured', String(entity.id)], entity)
    } else {
      SDC.del(['local_entities', 'featured', String(entity.id)])
    }
    return
  }
  function relate(eId1, rel1, eId2, rel2) {
    if (SDC.get(['relationships', String(eId1), rel1], []).indexOf(String(eId2)) === -1) {
      SDC.push(['relationships', String(eId1), rel1], String(eId2))
    }
    if (rel2) {
      if (SDC.get(['relationships', String(eId2), rel2], []).indexOf(String(eId1)) === -1) {
        SDC.push(['relationships', String(eId2), rel2], String(eId1))
      }
    }
  }
  function cacheBanner(opEntity, callback) {
    var bannerTypes = opEntity.get(['properties', 'type'], [])
    // debug(JSON.stringify(bannerTypes, null, 4))
    bannerTypes.forEach(function(bannerType) {
      // debug(JSON.stringify(bannerType, null, 4))
      relate(bannerType.reference, 'banner', opEntity.get(['id']), 'type')
    })
    callback()
  }
  function cacheEcho(opEntity, callback) {
    var categoryRefs = opEntity.get(['properties', 'category'], [])
    categoryRefs.forEach(function(categoryRef) {
      categoryRef = categoryRef.reference
      if (categoryRef) {
        function relateParents(categoryRef) {
          var parentCategoryRefs = SDC.get(['relationships', String(categoryRef), 'parent'], [])
          parentCategoryRefs.forEach(function(parentCategoryRef) {
            var parentDef = SDC.get(['local_entities', 'by_eid', String(parentCategoryRef), 'definition'], null)
            if (parentDef === 'category') {
              relateParents(parentCategoryRef)
              relate(opEntity.get('id'), 'category', parentCategoryRef, 'echo')
            }
          })
        }
        relate(opEntity.get('id'), 'category', categoryRef, 'echo')
        relateParents(categoryRef)
      }
    })
    callback()
  }
  function cacheCategory(opEntity, eClass, definition, callback) {
      // debug('!!! Cacheing ', opEntity.get('id'), eClass, definition)
      var parentEid = opEntity.get('id')
      entu.getChilds(parentEid, definition, APP_ENTU_OPTIONS)
      .then(function(opEntities) {
          // debug('!!! Fetch ' + definition + '@' + parentEid + ' from Entu succeeded.')
          myProcessEntities(parentEid, definition, definition, opEntities, callback)
      })
      .catch(function(reason) {
          debug('Caching category failed: ', reason)
          return callback(reason)
      })
  }
  function cachePerformance(opEntity, callback) {
      var perfRef = opEntity.get(['properties', 'premiere', 0, 'reference'], false)
      if (perfRef) {
          relate(opEntity.get('id'), 'premiere', perfRef, 'performance')
      }

      // Relate all related categories
      var categoryRefs = opEntity.get(['properties', 'category'], [])
      categoryRefs.forEach(function(categoryRef) {
          categoryRef = categoryRef.reference
          // var categoryRef = opEntity.get(['properties', 'category', 0, 'reference'], false)
          // debug('cachePerformance ' + opEntity.get('id'), categoryRef)
          if (categoryRef) {
              function relateParents(categoryRef) {
                  var parentCategoryRefs = SDC.get(['relationships', String(categoryRef), 'parent'], [])
                  // debug('!!! parentCategoryRefs', parentCategoryRefs)
                  parentCategoryRefs.forEach(function(parentCategoryRef) {
                      var parentDef = SDC.get(['local_entities', 'by_eid', String(parentCategoryRef), 'definition'], null)
                      if (parentDef === 'category') {
                          // debug('relate', opEntity.get('id'), 'category', parentCategoryRef, 'performance')
                          relateParents(parentCategoryRef)
                          relate(opEntity.get('id'), 'category', parentCategoryRef, 'performance')
                      }
                  })
              }
              relate(opEntity.get('id'), 'category', categoryRef, 'performance')
              relateParents(categoryRef)
          }
      })

      // Relate all related performances (Other Works)
      var otherWorks = opEntity.get(['properties', 'otherWork'], [])
      otherWorks.forEach(function(otherWork) {
          // debug('otherWork ', otherWork)
          relate(opEntity.get('id'), 'otherWork', otherWork.reference, 'otherWork')
      })

      var parentEid = opEntity.get('id')
      entu.getChilds(parentEid, null, APP_ENTU_OPTIONS)
      .then(function(entities) {
        async.each(entities, function(opEntity, callback) {
          if (opEntity.get(['properties', 'nopublish', 0, 'value']) === 'True') {
            return callback(null)
          }
          else {
            var entity = opEntity.get()
            relate(entity.id, 'parent', parentEid, entity.definition)
            add2cache(entity)
            callback()
          }
        }, function(err) {
          if (err) {
            debug('Each failed for childs of ' + parentEid)
            callback(err)
            return
          }
          // debug('Each succeeded for childs of ' + parentEid)
          callback()
        })
      })
      .catch(function(reason) {
        debug('Caching childs failed for performance: ' + parentEid, reason)
        return callback(reason)
      })
  }
  function cacheEvent(opEntity, callback) {
    var perfRef = opEntity.get(['properties', 'performance', 0, 'reference'], false)
    if (perfRef) {
      relate(opEntity.get('id'), 'performance', perfRef, 'event')
    }

    // Calculate duration of event
    var duration = (
      ( ( new Date(opEntity.get(['properties', 'end-time', 0, 'value'], 0)) ).getTime()
        -
        ( new Date(opEntity.get(['properties', 'start-time', 0, 'value'], 0)) ).getTime()
      ) / 1e3 / 60)
    if (duration > 0) {
      // debug(new Date(opEntity.get(['properties', 'start-time', 0, 'value'], 0)), new Date(opEntity.get(['properties', 'end-time', 0, 'value'], 0)))
      opEntity.set(['properties', 'duration', 0, 'value'], duration)
    }

    // Relate all related categories
    var categoryRefs = opEntity.get(['properties', 'category'], [])
    categoryRefs.forEach(function(categoryRef) {
      categoryRef = categoryRef.reference
      if (categoryRef) {
        function relateParents(categoryRef) {
          var parentCategoryRefs = SDC.get(['relationships', String(categoryRef), 'parent'], [])
          parentCategoryRefs.forEach(function(parentCategoryRef) {
            var parentDef = SDC.get(['local_entities', 'by_eid', String(parentCategoryRef), 'definition'], null)
            if (parentDef === 'category') {
              relateParents(parentCategoryRef)
              relate(opEntity.get('id'), 'category', parentCategoryRef, 'event')
            }
          })
        }
        relate(opEntity.get('id'), 'category', categoryRef, 'event')
        relateParents(categoryRef)
      }
    })


    var parentEid = opEntity.get('id')
    entu.getChilds(parentEid, null, APP_ENTU_OPTIONS)
    .then(function(entities) {
      // debug('Childs ' + entities.map(function(e) {return e.get('id')}).join(','))
      async.eachLimit(entities, 1, function(opEntity, callback) {
        var entity = opEntity.get()
        // debug('Fetched ' + entity.id + ' - child of ' + parentEid)
        if (opEntity.get(['properties', 'nopublish', 0, 'value']) === 'True') {
          // debug('callback [002] in 0.2')
          setTimeout(function () {
            // debug('callback [002]')
            return callback(null)
          }, 61)
        }
        else {
          relate(entity.id, 'parent', parentEid, entity.definition)
          
          add2cache(entity)
          if (opEntity.get('definition') === 'event') {
            cacheEvent(opEntity, callback)
          } else {
            // debug('callback [001] in 0.2')
            setTimeout(function () {
              // debug('callback [001]')
              return callback(null)
            }, 61)
          }
        }
      }, function(err) {
        if (err) {
          debug('Each failed for childs of ' + parentEid)
          return callback(err)
        }
        // debug('Each succeeded for childs of ' + parentEid)
        callback()
      })
    })
    .catch(function(reason) {
      debug('Caching childs failed for event: ' + parentEid, reason)
      return callback(reason)
    })
  }

  if (entities.length === 0) { return callback() }
  debug('Processing ' + entities.length + ' entities (' + eClass + '|' + definition + ').')
  async.eachLimit(entities, 1, function(opEntity, callback) {
    if (opEntity.get(['properties', 'nopublish', 0, 'value']) === 'True') {
      // debug('callback [003] in 0.2')
      setTimeout(function () {
        // debug('callback [003]')
        return callback(null)
      }, 61)
    }
    else {
      var entity = opEntity.get()
      if (parentEid) {
        if (SDC.get(['relationships', String(entity.id), 'parent'], []).indexOf(String(parentEid)) === -1) {
          SDC.push(['relationships', String(entity.id), 'parent'], String(parentEid))
        }
        if (SDC.get(['relationships', String(parentEid), 'child'], []).indexOf(String(entity.id)) === -1) {
          SDC.push(['relationships', String(parentEid), 'child'], String(entity.id))
        }
      }
      
      add2cache(entity, eClass)
      switch (definition) {
        case 'category':
          cacheCategory(opEntity, eClass, definition, callback)
          break
        case 'event':
          cacheEvent(opEntity, callback)
          break
        case 'performance':
          cachePerformance(opEntity, callback)
          break
        case 'news':
          callback()
          break
        case 'coverage':
          callback()
          break
        case 'person':
          callback()
          break
        case 'location':
          callback()
          break
        case 'banner-type':
          callback()
          break
        case 'banner':
          cacheBanner(opEntity, callback)
          break
        case 'echo':
          cacheEcho(opEntity, callback)
          break
        default:
          debug('Unhandled definition: ' + definition)
          break
      }
      // debug(opEntity.get('id'))
    }
  }, function(err) {
    if (err) {
      debug('Each failed for myProcessEntities')
      callback(err)
      return
    }
    callback()
  })
}


// Fetch from Entu
cacheSeries.push(function fetchFromEntu(callback) {
  debug('Fetch from Entu at ' + Date().toString())

  async.eachLimit(cacheFromEntu, 1, function(options, callback) {
    var definition = options.definition
    var eClass = options.class
    // debug('Fetch1 ' + JSON.stringify(options) + ' from Entu.')
    if (options.parent) {
      var parentEid = options.parent
      // debug('Fetch2 ' + definition + '@' + parentEid + ' from Entu.')
      entu.getChilds(parentEid, definition, APP_ENTU_OPTIONS)
      .then(function(opEntities) {
        // debug('Fetch2 ' + definition + '@' + parentEid + ' from Entu succeeded.')
        myProcessEntities(parentEid, eClass, definition, opEntities, callback)
      })
      .catch(function(reason) {
        debug('Fetch2 ' + definition + '@' + parentEid + ' from Entu failed.', reason)
        setTimeout(function () {
          return callback(reason)
        }, 61)
      })
    } else {
      debug('Fetch3 ' + definition + '@' + JSON.stringify(options) + ' from Entu.')
      entu.getEntities(definition, null, null, APP_ENTU_OPTIONS)
      .then(function(opEntities) {
        myProcessEntities(null, eClass, definition, opEntities, callback)
      })
      .catch(function(reason) {
        debug('Fetch3 ' + definition + '@' + JSON.stringify(options) + ' from Entu failed.', reason)
        setTimeout(function () {
          return callback(reason)
        }, 61)
      })
    }
  }, function(err) {
    if (err) {
      debug('Each failed for fetch from Entu')
      return callback(err)
    }
    debug('Each succeeded for fetch from Entu')
    callback()
  })
})


function setLastPollTs(newTs) {
  debug('setLastPollTs. Current: ' + SDC.get('lastPollTs') + ', new: ' + newTs)
  if (newTs && newTs > SDC.get(['lastPollTs'], 1)) {
    SDC.set(['lastPollTs'], newTs)
  }
  else {
    var currentTs = Math.max.apply(
      Math,
      Object.keys(SDC.get(['local_entities', 'by_eid'], []))
      .map(function(key) {
        return SDC.get(['local_entities', 'by_eid', key, 'changedTs'])
      })
    )
    if (currentTs > SDC.get(['lastPollTs'], 1)) {
      SDC.set('lastPollTs', currentTs)
    }
  }
  debug('setLastPollTs. Current: ' + SDC.get('lastPollTs'))
}


// Save cache
function saveCache(callback) {
  debug('LASTTS 1: ' + SDC.get('lastPollTs'))
  setLastPollTs()
  debug('LASTTS 2: ' + SDC.get('lastPollTs'))
  debug('Save Cache at ' + Date().toString())

  async.each(Object.keys(SDC.get()), function(filename, callback) {
    debug('Saving ' + filename)
    fs.writeFile(path.join(APP_CACHE_DIR, filename + '.json' + '.download'), JSON.stringify(SDC.get(filename), null, 2), (err) => {
      if (err) { return callback(err) }
      fs.rename(path.join(APP_CACHE_DIR, filename + '.json' + '.download'), path.join(APP_CACHE_DIR, filename + '.json'), function(err) {
        if (err) { return callback(err) }
        callback()
      })
    })
  }, function(err) {
    if (err) {
      debug('Saving cache failed', err)
      return callback(err)
    }
    debug('Cache saved as of ' + SDC.get('date') )
    callback()
  })
}
cacheSeries.push(saveCache)


// Final cleanup
cacheSeries.push(function cleanup(callback) {
  callback()
  state = 'sleeping'
})



function pollEntu(report, workerReloadCB) {
  debug('Polling Entu')
  var updated = false
  // debug('Setting updated = ', updated)

  function removeFromCache(eId1, callback) {
    debug('removeFromCache(' + eId1 + ').')
    // 1st we remove relationships to and from eId1
    var relationshipDefinitions = Object.keys(SDC.get(['relationships', String(eId1)], {}))
    var affectedEIds = []
    async.each(relationshipDefinitions, function(rDef, callback) {
      async.each(SDC.get(['relationships', String(eId1), rDef], []), function(eId2, callback) {
        affectedEIds.push(eId2)
        callback()
      }, function(err) {
        if (err) { return callback(err) }
        callback()
      })
    }, function(err) {
      if (err) { return callback(err) }
      updated = affectedEIds.length > 0
      debug('Setting updated = ', updated)
      async.each(affectedEIds, function(eId2, callback) {
        var reverseRlationshipDefinitions = Object.keys(SDC.get(['relationships', String(eId2)], {}))
        async.each(reverseRlationshipDefinitions, function(rDef, callback) {
          async.each(SDC.get(['relationships', String(eId1), rDef], []), function(eId2, callback) {
            SDC.del(['relationships', String(eId1), rDef, eId2])
            callback()
          }, function(err) {
            if (err) { return callback(err) }
            if (SDC.get(['relationships', String(eId1), rDef], []).length === 0) {
              SDC.del(['relationships', String(eId1), rDef])
            }
            callback()
          })
        }, function(err) {
          if (err) { return callback(err) }
          if (relationshipDefinitions.length === 0) {
            SDC.del(['relationships', String(eId1)])
          }
          SDC.del(['relationships', String(eId1)])
          callback()
        })
      }, function(err) {
        if (err) { return callback(err) }
        SDC.del(['relationships', String(eId1)])
        // Relationships are destroyed. Remove entities from SDC as well
        var definitions = cacheFromEntu
          .map(function(a) { return a.definition })
          .filter(function(a, ix, self) { return self.indexOf(a) === ix })
        // debug('Candidate definitions', definitions)
        definitions.forEach(function(a) { SDC.del(['local_entities', 'by_definition', a, eId1]) })
        var classes = cacheFromEntu
          .map(function(a) { return a.class })
          .filter(function(a, ix, self) { return self.indexOf(a) === ix })
        // debug('Candidate classes', classes)
        classes.forEach(function(a) { SDC.del(['local_entities', 'by_class', a, eId1]) })
        SDC.del(['local_entities', 'featured', eId1])
        SDC.del(['local_entities', 'by_eid', eId1])
        debug('removeFromCache(' + eId1 + ') done.')
        callback()
      })
    })
  }
  // debug(APP_ENTU_OPTIONS)

  var pollOptions = {}
  Object.keys(APP_ENTU_OPTIONS).forEach(function(key) {
      pollOptions[key] = APP_ENTU_OPTIONS[key]
  })
  pollOptions.timestamp = SDC.get(['lastPollTs'], 1454661210) + 1
  pollOptions.limit = 100
  entu.pollUpdates(pollOptions)
  .then(function(result) {
    // debug('pollUpdates got ', result)
    var updates = result.updates.filter(function(a) { return a.action !== 'created at' })
    updates.sort(function(a,b) { return a.timestamp - b.timestamp }) // Ascending sort by timestamp
    if (updates.length) {
      debug('pollUpdates got ' + updates.length + ' tasks to check.')
    }
    var toGo = updates.length
    async.eachSeries(updates, function(update, callback) {
      if (update.action === 'deleted at') {
        if (update.timestamp > 0) { setLastPollTs(update.timestamp) }
        debug('(' + (toGo--) + ') Removing ' + update.definition + ' ' + update.id + ' @ ' + update.timestamp + (new Date(update.timestamp*1000)))
        return removeFromCache(update.id, callback)
      }
      if (update.timestamp > 0) { setLastPollTs(update.timestamp) }
      debug('(' + (toGo--) + ') Updating ' + update.definition + ' ' + update.id + ' @ ' + update.timestamp + ' ' + (new Date(update.timestamp*1000)))
      entu.pollParents(update.id, APP_ENTU_OPTIONS)
      .then(function(parents) {
        var currentParents = parents.map(function(element) { return Number(element.id) })
        var filteredCFE = cacheFromEntu.filter(function(n) {
          return currentParents.indexOf(Number(n.parent)) !== -1
        })
        return filteredCFE
      })
      .catch(function(reason) {
        debug('\n\n!!!\nFetching parents of ' + update.definition + ' ' + update.id + ' @ ' + update.timestamp, 'failed:', reason)
        return callback(reason)
      })
      .then(function(parents) {
        // debug('1. Filtered parents of ', update, ': ', parents)
        entu.getEntity(update.id, APP_ENTU_OPTIONS)
        .then(function(opEntity) {
          if (opEntity.get(['properties', 'nopublish', 0, 'value']) === 'True') {
            debug('Unpublishing ' + update.definition + ' ' + update.id + ' @ ' + update.timestamp)
            setTimeout(function () {
              return removeFromCache(update.id, callback)
            }, 61)
          }
          else {
            parents = parents.filter(function(element) {
              return opEntity.get(['definition']) === element.definition
            })
            // debug('2. Filtered parents of ', update, ': ', parents)
            async.each(parents, function(parent, callback) {
              myProcessEntities(null, parent.class, parent.definition, [opEntity], callback)
            }, function(err) {
              if (err) { return callback(err) }
              // debug('1.Entity: ' + JSON.stringify(opEntity.get(['definition']) + ' ' + opEntity.get(['id']), null, 4), 'Parents: ', parents)
              // debug('SDC.set([\'lastPollTs\'], ' + update.timestamp)
              SDC.set(['lastPollTs'], update.timestamp)
              updated = true
              debug('Setting updated = ', updated)
              return callback(null)
            })
          }
        })
        .catch(function(reason) {
          debug('1. Filtered parents of ', update, ': ', parents, 'failed:', reason)
          return callback(reason)
        })
      })
      .catch(function(reason) {
        debug('\n\n!!!\nUpdating ' + update.definition + ' ' + update.id + ' @ ' + update.timestamp, 'failed:', reason)
        return callback(reason)
      })
    }, function(err) {
      if (err) {
        var message = '*INFO*: Cache routine stumbled. Restart in ' + ENTU_POLL_SEC / 1e2
        console.log(message, new Date(), err)
        report(message, {
          level: 'warning',
          extra: { err: err }
        })
        setTimeout(function() { pollEntu(report, workerReloadCB) }, ENTU_POLL_SEC * 10)
      }
      else {
        console.log('Cache routine finished', new Date())
        setTimeout(function() { pollEntu(report, workerReloadCB) }, ENTU_POLL_SEC)
        if (updated) {
          debug('We have updated = ', updated)
          updated = false
          debug('Setting updated = ', updated)
          saveCache(workerReloadCB)
        }
      }
    })
  })
  .catch(function(reason) {
    var message = '*INFO*: nPoll updates failed. Restart in ' + ENTU_POLL_SEC / 1e2
    console.log(message, new Date(), reason)
    report(message, {
      level: 'warning',
      extra: { err: reason }
    })
    setTimeout(function() { pollEntu(report, workerReloadCB) }, ENTU_POLL_SEC * 10)
  })
}



function performSync(report, workerReloadCB) {
    // Set lastPollTs from freshly cached data
    // debug(APP_ENTU_OPTIONS)
    debug('Caching Started.')
    report('Caching started.')
    debug('Performing cache sync at ' + Date().toString())
    async.series(cacheSeries, function syncFinally(err) {
        if (err === CACHE_LOADED_MESSAGE) {
            debug('*NOTE*: Cache sync succeeded. ' + CACHE_LOADED_MESSAGE)
            workerReloadCB()
            return pollEntu(report, workerReloadCB)
        }
        else if (err) {
            var message = '*INFO*: Cache sync stumbled. Restart in 25'
            debug(message, err)
            report(message, {
                level: 'warning',
                extra: { err: err }
            })
            return setTimeout(function() { performSync(report, workerReloadCB) }, 25e3)
        }
        // successful initial sync should error with CACHE_LOADED_MESSAGE
        debug('*NOTE*: Cache sync succeeded. Expecting "' + CACHE_LOADED_MESSAGE + '" on next try.')
        performSync(report, workerReloadCB)
    })
}

performSync(
  (data) => { console.log('Report: ' + data) },
  () => { console.log('Callback') }
)

// module.exports.sync = performSync
module.exports.stat
