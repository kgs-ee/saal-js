/**
**  Events to datepicker
*/
function datePickerInit() {
    var baseHref = document.getElementsByTagName('base')[0].getAttribute("href")
    locale = baseHref.split('/')[1]
    // locale = ((baseHref == '/et/') ? "et" : "en")

    var options = $.extend(
        {},
        $.datepicker.regional[locale],
        { dateFormat: "d MM, y" }
    )
    $.datepicker.setDefaults(options)

    // $( "#datepicker").datepicker({
    //   beforeShowDay: available,
    //   prevText: '<',
    //   nextText: '>',
    //   weekStart: 1
    // })

    var arrEvents = {}
    var currentTitle = ""
    $.getJSON('http://kgs-ee.github.io/saal-js/javascripts/campo-json.json', function(response) {
    // $.getJSON(window.location.protocol + '//' + window.location.host + '/public/campo_json.json', function(response){

        for (var key in response) {
            //console.log(key)
            var keys = key.split("-")
            var d = new Date(keys[0], keys[1] - 1, keys[2])
            arrEvents[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = response[key]
            //console.log(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate())
        }

        //$("#datepicker").html("")
        $("#datepicker").datepicker({
            dateFormat : "yy-mm-dd",
            prevText : '<',
            nextText : '>',
            onChangeMonthYear: function(year, month, inst) {
                // hack default behaviour.
                setTimeout(function(){
                    toggleTooltip({show:false})
                }, 0)
            },
            onSelect: function(dateText, inst) {
                //console.log(dateText)
                var parts = dateText.split("-")
                //console.log(parts)
                var clickedDate = new Date(parts[0], parts[1] - 1, parts[2])
                //var clickedDate = new Date(dateText)
                var dateString = clickedDate.getFullYear() + "-" + (clickedDate.getMonth() + 1) + "-" + clickedDate.getDate()
                var eventsByDate = arrEvents[dateString]
                var urlTo = ""

                if (eventsByDate.length > 1) {
                    urlTo = eventsByDate[0].multiUrl
                } else {
                    urlTo = eventsByDate[0].url
                }
                window.location = urlTo
            },
            beforeShowDay: function(date) {

                var dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()

                //console.log(dateString)
                //console.log(arrEvents)
                //console.log(arrEvents["2012-9-29"])
                var eventsByDate = arrEvents[dateString]

                var isClickable = false
                var extraClass = ""
                var tooltip = null

                if (eventsByDate) {
                    isClickable = true
                    extraClass = "highlight"
                    if (eventsByDate.length > 1) {
                        extraClass += " multiple"
                    }
                    tooltip = "<ul class='list-unstyled'>"
                    for (var e in eventsByDate) {
                        var event = eventsByDate[e]
                        /*console.log(event);*/
                        extraClass += " " + event.extraClasses
                        var time = (event.time != "00:00") ? (event.time + " uur ") : ""
                        tooltip += "<li class='" + event.extraClasses + "'>" + time + ": "  + event.name + ((event.short) ? (" - " + event.short) : "") + "</li>"
                        tooltip += "<li class='" + event.extraClasses + "'>"
                            tooltip += event.name + ((event.short) ? (" - " + event.short) : "") + "<br />"
                            tooltip += event.client + ((event.city) ? (" - " + event.city) : "")
                            tooltip += event.name + ((event.short) ? (" - " + event.short) : "") + "<br />"

                        tooltip += "</li>"
                    }
                    tooltip += "</ul>"
                }
                return [isClickable, extraClass, tooltip]
            }
        })
    })
}


/**
**  Calendar tooltip
*/
function calToolTip() {
    $('body').tooltip({
        selector: '[data-handler="selectDay"]',
        html: true,
        container: "body",
        placement: "bottom"
    })
}


/**
**  Frontpage slider height
*/
function eventBannerHeight() {
    windowHeight = $(window).height()
    navHeight = $('.navbar-default').outerHeight(true)

    $(".event-banner figure").height(windowHeight - navHeight)
}


/**
**  Programme category dropdown
*/
function categoryDropDown() {
    var options = []

    $( '.dropdown-menu a' ).on( 'click', function( event ) {

        var $target = $( event.currentTarget ),
             val = $target.attr( 'data-value' ),
             $inp = $target.find( 'input' ),
             idx

        if ( ( idx = options.indexOf( val ) ) > -1 ) {
            options.splice( idx, 1 )
            setTimeout( function() { $inp.prop( 'checked', false ) }, 0)
        } else {
            options.push( val )
            setTimeout( function() { $inp.prop( 'checked', true ) }, 0)
        }

        $( event.target ).blur()

        console.log( options )
        return false
    })
}


/**
**  Google Maps
*/
function initMap() {
    var myLatlng = new google.maps.LatLng(59.438552,24.745975)

    var mapOptions = {
        center: myLatlng,
        zoom: 18
    }

    var map = new google.maps.Map(document.getElementById('map'),
    mapOptions)

    var marker = new google.maps.Marker({
        position: myLatlng,
        map: map,
        title: 'Kanuti Gildi Saal'
    })
}


/**
**  Fancybox Gallery
*/
function fancyBoxGallery() {
    $(".fancybox").fancybox({
        padding: 0,
        helpers: {
            overlay: {
                locked: false
            }
        }
    })
}


/**
**  Read More generator
*/
function shortenTexts() {
    $(".main-text").shorten({
        moreText: 'Loe edasi',
        lessText: 'Loe vähem',
        showChars: '1000'
    })
}



$(document).ready(function() {
    datePickerInit()
    calToolTip()
    fancyBoxGallery()
    shortenTexts()
    // eventBannerHeight()
    //initMap()
    categoryDropDown()
})

$(window).load(function() {
    eventBannerHeight()
    calToolTip()
})

$(window).resize(function() {
    eventBannerHeight()
})
