
var express = require('express')
var router = express.Router()

var request     = require('request')


router.get('/', function(req, res, next) {

    var url = 'https://saal.entu.ee/api2/entity?definition=event&limit=10&order_by=time'
    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	//console.log(data.result)
        	var count = data.count
            res.render("events", {
                count: count,
                title: "Sündmused",
                events: data.result
            })
        }
    )
})

module.exports = router
