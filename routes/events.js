
var express = require('express')
var router = express.Router()

var request     = require('request')


/* GET users listing. */
router.get('/', function(req, res, next) {
	// var user_id = req.params.user_id

    var url = 'https://saal.entu.ee/api2/entity?definition=event&limit=10'
    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	console.log(data.result)
        	var count = data.count
            // var result = data.result
            // var item = data.result[1].name
            res.render("index", {
                count:count, 
                title:"zaza", 
                events:data.result
            })
        }
    )
})

module.exports = router
