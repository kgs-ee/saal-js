var express = require('express')
var router = express.Router()
var request = require('request')


router.get('/', function(req, res, next) {

    var url = 'https://saal.entu.ee/api2/entity?definition=news&limit=10'
    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	//console.log(data.result)
        	var count = data.count
            res.render("contact", {
                count: count,
                title: "Kontakt",
                newsList: data.result
            })
        }
    )
})

module.exports = router