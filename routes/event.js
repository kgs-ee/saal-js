
var express = require('express')
var router = express.Router()

var request     = require('request')

router.get('/', function(req, res, next) {
    //console.log(req.query.id)
    var url = 'https://saal.entu.ee/api2/entity-' + req.query.id
    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)
        	//console.log(data.result)
            console.log(data.result.displaypicture)
            res.render("event", {
                title: data.result.displayname,
                image: data.result.displaypicture,
                content: data.result.properties.description.values[0].value,
                schedule: data.result.displayinfo,
                price: data.result.properties.price.values[0].value,
                categories: data.result.properties.category.values,
            })
        }
    )
})

module.exports = router
