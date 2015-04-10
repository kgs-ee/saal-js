
var express = require('express')
var router = express.Router()

var request     = require('request')


/* GET users listing. */
router.get('/:user_id', function(req, res, next) {
	var user_id = req.params.user_id

    var url = 'https://saal.entu.ee/api2/entity-' + user_id
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
