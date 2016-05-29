var fs    = require('fs')
var path  = require('path')
var yaml  = require('js-yaml')
var op    = require('object-path')
var debug = require('debug')('app:' + path.basename(__filename).replace('.js', ''))

var i18nConfig = {}



exports.configure = function configure(config) {
    if (!config) { config = {} }

    i18nConfig.file = config.file || path.join(__dirname, 'localization', 'locales.yaml')
    i18nConfig.locales = config.locales || ['et', 'en']
    i18nConfig.redirectWrongLocale = config.redirectWrongLocale || true
    i18nConfig.defaultLocale = config.defaultLocale || 'et'
    i18nConfig.updateFile = config.updateFile || false

    i18nConfig.translations = {}
    if (fs.existsSync(i18nConfig.file)) { i18nConfig.translations = yaml.safeLoad(fs.readFileSync(i18nConfig.file)) }
}


function translate(key) {
    var value = op.get(i18nConfig, 'translations.' + key + '.' + i18nConfig.lang)
    if (!value && i18nConfig.updateFile === true && i18nConfig.locales.indexOf(i18nConfig.lang) > -1) {
        op.set(i18nConfig, 'translations.' + key + '.' + i18nConfig.lang, key)

        fs.writeFile(i18nConfig.file, yaml.safeDump(i18nConfig.translations, { sortKeys: true, indent: 4 }), function(err) {
            if (err) { return console.log(err) }
        })
    }
    return value || key
}

exports.init = function init(req, res, next) {
    i18nConfig.lang = req.path.split('/')[1] || i18nConfig.defaultLocale

    if (i18nConfig.redirectWrongLocale === true && req.path === '/') { return res.redirect('/' + i18nConfig.lang) }
    if (i18nConfig.redirectWrongLocale === true && i18nConfig.locales.indexOf(i18nConfig.lang) === -1) {
        var path = req.path.split('/')
        path[1] = i18nConfig.defaultLocale
        return res.redirect(path.join('/'))
    }

    res.locals.lang = i18nConfig.lang
    res.locals.t = translate
    res.locals.locales = i18nConfig.locales
    exports.lang = i18nConfig.lang
    exports.locales = i18nConfig.locales
    exports.lang = i18nConfig.lang
    // debug('locales prepped', i18nConfig.locales)
    next()
}



exports.translate = translate
