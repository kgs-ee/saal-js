var express = require('express');
var router = express.Router();

var request     = require('request')

router.get('/', function(req, res, next) {

	var eventUrl = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=name&changed=dt'
	var bannerUrl = 'https://saal.entu.ee/api2/entity?definition=banner&limit=3'

	var eventOptions = { strictSSL: true, url: eventUrl }
	var bannerOptions = { strictSSL: true, url: bannerUrl }
	
	request.get(eventOptions, function (err, response, body) {
		event_data = JSON.parse(body).result
		
		request.get(bannerOptions, function (err, response, body) {
			banner_data = JSON.parse(body).result
				// var count = data.count
			res.render("index", {
				events: event_data,
				banners: banner_data
			})
		})
	})
})

module.exports = router;
