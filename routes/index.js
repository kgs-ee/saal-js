var express = require('express');
var router = express.Router();

var request     = require('request')

router.get('/', function(req, res, next) {

    var eventUrl = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=name&changed=dt'
    request.get({
        strictSSL: true,
        url: eventUrl
        },
        function (err, response, body) {
        	data = JSON.parse(body)
            res.render("index", {
                events:data.result
            })
        }
    )

    var bannerUrl = 'https://saal.entu.ee/api2/entity?definition=banner&limit=3'
    request.get({
        strictSSL: true,
        url: bannerUrl
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	var count = data.count
            res.render("index", {
                banners:data.result
            })
        }
    )
})

module.exports = router;
