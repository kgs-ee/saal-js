module.exports.monthNav = function monthNav(year, month) {
    month = parseInt(month, 10)
    year = parseInt(year, 10)
    return {
        'prev': {
            'year': month > 1 ? year : year - 1,
            'month': month > 1 ? month - 1 : 12
        },
        'current': {
            'year': year,
            'month': month
        },
        'next': {
            'year': month < 12 ? year : year + 1,
            'month': month < 12 ? month + 1 : 1
        }
    }
}

module.exports.arraySubtract = function arraySubtract(arr, val) {
    var retArr = []
    arr.forEach(function(el) {
        if (String(val) !== String(el)) {
            retArr.push(el)
        }
    })
    return retArr
}
