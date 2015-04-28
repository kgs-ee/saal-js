
var express = require('express')
var router = express.Router()

var request     = require('request')

router.get('/', function(req, res, next) {
    console.log(req.query.id)


    var url = 'https://saal.entu.ee/api2/entity-' + req.query.id
    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	console.log(data.result)
            res.render("event", {
                event:data.result
            })
        }
    )
})

module.exports = router
