
var express = require('express')
var router = express.Router()

var request     = require('request')


/* GET users listing. */
router.get('/', function(req, res, next) {

    var url = 'https://saal.entu.ee/api2/entity?definition=event'
    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	console.log(data)
        	var count = data.count
            res.render("index", {count:count, title:"zaza"})
        }
    )
})

module.exports = router
