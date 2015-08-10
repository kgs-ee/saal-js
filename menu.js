var request = require('request')
var path    = require('path')
var fs      = require('fs')

var menu_path = __dirname + '/menu.json'

var menu = ''
// var menu = JSON.parse(fs.readFileSync(menu_path))


var options = {
        url: APP_ENTU_URL + '/entity-1920/childs',
        qs: {definition: 'web-content'},
        strictSSL: true,
        json: true
    }

request.get(options,
    function(error, response, body) {
        if(error) throw error
        if(response.statusCode !== 200 || !body.result) throw new Error(body)
        menu = body.result['web-content']['entities']
        console.log(path.dirname(__dirname))
        fs.writeFile(menu_path, JSON.stringify(menu), function callback(err) {
            if (err) throw err;
        })

    }
)

module.exports = menu