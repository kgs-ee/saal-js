var express  = require('express');
var router   = express.Router();
var request  = require('request')

// router.get('/', function(req, res, next) {
// 	var eventUrl = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=name&changed=dt'
// 	var bannerUrl = 'https://saal.entu.ee/api2/entity?definition=banner&limit=3'

// 	var eventOptions = { strictSSL: true, url: eventUrl }
// 	var bannerOptions = { strictSSL: true, url: bannerUrl }

// 	request.get(eventOptions, function getEvents(err, response, body) {
// 		if (err) {
// 			console.log('Err:', err, response)
// 			return // from getEvents
// 		}
// 		var event_data = JSON.parse(body).result

// 		request.get(bannerOptions, function getBanners(err, response, body) {
// 			if (err) {
// 				console.log('Err:', err, response)
// 				return // from getBanners
// 			}
// 			var banner_data = JSON.parse(body).result
// 			res.render("index", {
// 				events: event_data,
// 				banners: banner_data
// 			})
// 		})
// 	})
// })
//
//
// Alternate way to gather data from multiple sources
// router.get('/', function(req, res, next) {
// 	var eventUrl = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=time'
// 	var bannerUrl = 'https://saal.entu.ee/api2/entity?definition=banner&limit=3'

// 	var eventOptions = { strictSSL: true, url: eventUrl }
// 	var bannerOptions = { strictSSL: true, url: bannerUrl }

// 	var event_data
// 	var banner_data

// 	request.get(eventOptions, function getEvents(err, response, body) {
// 		if (err) {
// 			console.log('Err:', err, response)
// 			return // from getEvents
// 		}
// 		event_data = JSON.parse(body).result
// 		render()
// 	})

// 	request.get(bannerOptions, function getBanners(err, response, body) {
// 		if (err) {
// 			console.log('Err:', err, response)
// 			return // from getBanners
// 		}
// 		banner_data = JSON.parse(body).result
// 		render()
// 	})

// 	var render = function render() {
// 		if (banner_data === undefined) {
// 			return
// 		}
// 		if (event_data === undefined) {
// 			return
// 		}
// 		res.render("index", {
// 			title: "Esileht",
// 			events: event_data,
// 			banners: banner_data
// 		})
// 	}
// })
// module.exports = router;

router.get('/', function(req, res, next) {
	var eventUrl = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=time'
	var bannerUrl = 'https://saal.entu.ee/api2/entity?definition=banner&limit=3'
	var entity_url = 'https://saal.entu.ee/api2/entity-'

	var eventOptions = { strictSSL: true, url: eventUrl }
	var bannerOptions = { strictSSL: true, url: bannerUrl }

	var event_data
	var banner_data

	request.get(eventOptions, function getEvents(err, response, body) {
		if (err) {
			console.log('Err:', err, response)
			return // from getEvents
		}
		event_data = JSON.parse(body).result
		render()
	})

	request.get(bannerOptions, function getBanners(err, response, body) {
		if (err) {
			console.log('Err:', err, response)
			return // from getBanners
		}

		var banner_data = JSON.parse(body)
		var render_data = []

			banner_data.result.forEach(function iterate(item) { 
				
				request.get({strictSSL: true, url: entity_url + item.id}, function getSingleBanner(err, response, body) { 
					if (err) {
                    	console.log('Err:', err, response)
                    	return
                	}

                	render_data = JSON.parse(body)

                	//File-ID for URL
                	console.log(render_data.result.properties.photo.values[0].db_value)
				})
			})

		render()
	})

	var render = function render() {
		if (render_data === undefined) {
			return
		}
		if (event_data === undefined) {
			return
		}
		res.render("index", {
			title: "Esileht",
			events: event_data,
			banners: render_data
		})
	}
})
module.exports = router;
