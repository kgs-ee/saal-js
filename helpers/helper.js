module.exports.monthNav = function monthNav(year, month) {
    month = parseInt(month)
    year = parseInt(year)
    return {
        "prev": {
            "year": month > 1 ? year : year - 1,
            "month": month > 1 ? month - 1 : 12
        },
        "current": {
            "year": year,
            "month": month
        },
        "next": {
            "year": month < 12 ? year : year + 1,
            "month": month < 12 ? month + 1 : 1
        }
    }
}

module.exports.arraySubtract = function arraySubtract(arr, val) {
    var ret_arr = []
    arr.forEach(function(el) {
        if (String(val) !== String(el)) {
            ret_arr.push(el)
        }
    })
    return ret_arr
}
