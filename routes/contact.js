var express = require('express')
var router = express.Router()
var request = require('request')
var md = require("node-markdown").Markdown

router.get('/', function(req, res, next) {

    var news_list_url = 'https://saal.entu.ee/api2/entity?definition=news&limit=10'
    var entity_url = 'https://saal.entu.ee/api2/entity-'

    var contact_options = {strictSSL: true, url: news_list_url}
    request.get(contact_options, function getContacts(err, response, body) {
        if (err) {
            console.log('Err:', err, response)
            return
        }
        var contact_data = JSON.parse(body)

        // console.log(contact_data.result)

        var render_data = []
        var proccess_count = 0

        contact_data.result.forEach(function iterate(item) {
            proccess_count ++
            request.get({strictSSL: true, url: entity_url + item.id}, function getContacts(err, response, body) {
                if (err) {
                    console.log('Err:', err, response)
                    return
                }
                item['body'] = JSON.parse(body).result.properties.body.values ? JSON.parse(body).result.properties.body.values[0].value : 'No body'
                item['body_md'] = md(item['body'])
                render_data.push(item)
                proccess_count --
                if (proccess_count === 0) {
                    var compare = function compare(a, b) {
                        if (a.info < b.info)
                            return 1
                        if (a.info > b.info)
                            return -1
                        return 0
                    }
                    render_data.sort(compare)
                    // console.log(render_data)
                    res.render("contact", {
                        contact_count: contact_data.count,
                        title: "Kontakt",
                        newsList: render_data
                    })
                }
            })
        })


    })
})

module.exports = router

// router.get('/', function(req, res, next) {
//  var eventUrl = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=name&changed=dt'
//  var bannerUrl = 'https://saal.entu.ee/api2/entity?definition=banner&limit=3'

//  var eventOptions = { strictSSL: true, url: eventUrl }
//  var bannerOptions = { strictSSL: true, url: bannerUrl }

//  request.get(eventOptions, function getEvents(err, response, body) {
//      if (err) {
//          console.log('Err:', err, response)
//          return // from getEvents
//      }
//      var event_data = JSON.parse(body).result

//      request.get(bannerOptions, function getBanners(err, response, body) {
//          if (err) {
//              console.log('Err:', err, response)
//              return // from getBanners
//          }
//          var banner_data = JSON.parse(body).result
//          res.render("index", {
//              events: event_data,
//              banners: banner_data
//          })
//      })
//  })
// })
