
var express = require('express')
var router = express.Router()
var request = require('request')

router.get('/', function(req, res, next) {
    var url = 'https://saal.entu.ee/api2/entity-' + req.query.id

    request.get({
        strictSSL: true,
        url: url
        },
        function (err, response, body) {
        	data = JSON.parse(body)

            res.render("event", {
                title: data.result.displayname,
                imageId: data.result.properties.photo.values[0].db_value,
                content: data.result.properties.description.values[0].value,
                schedule: data.result.properties.time.values,
                price: data.result.properties.price.values[0].value,
                categories: data.result.properties.category.values,
            })
        }
    )
})

module.exports = router
