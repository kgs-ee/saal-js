/**
**  Events to datepicker
*/
function datePickerInit() {
    var baseHref = document.getElementsByTagName('base')[0].getAttribute("href")
    locale = baseHref.split('/')[1]

    var options = $.extend(
        {},
        $.datepicker.regional[locale],
        { dateFormat: "d MM, y" }
    )
    $.datepicker.setDefaults(options)

    var arrEvents = {}
    var currentTitle = ""
    $.getJSON('calendar_json', function(response){

        for (var key in response) {
            var keys = key.split("-")
            var d = new Date(keys[0], keys[1] - 1, keys[2])
            arrEvents[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = response[key]
        }

        $("#datepicker").datepicker({
            dateFormat : "yy-mm-dd",
            prevText : '<',
            nextText : '>',

            beforeShowDay: function(date) {

                var dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()

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

                        extraClass += " " + event.tag
                        var time = (event.time != "00:00") ? (event.time) + ' ' : ""
                        var name = (locale == "et") ? event['et-name'] : event['en-name']

                        tooltip += "<li class='" + event.tag + "'><a href='/" + locale + "/performance/" + event.id + "'>" + time + name + " / " + event.location + "</a></li>"
                        // tooltip += "<li class='" + event.extraClasses + "'>"
                        //     tooltip += event.name + ((event.short) ? (" - " + event.short) : "") + "<br />"
                        //     tooltip += event.client + ((event.city) ? (" - " + event.city) : "")
                        //     tooltip += event.name + ((event.short) ? (" - " + event.short) : "") + "<br />"

                        tooltip += "</li>"
                    }
                    tooltip += "</ul>"
                }
                return [isClickable, extraClass, tooltip]
            }
        })
    })
}

/*
** Calendar width fix
*/
function calendarWidth() {
    $('#datepicker').width($('.datepicker-container').width());
}


/**
**  Calendar tooltip
*/
function calToolTip() {
    var originalLeave = $.fn.popover.Constructor.prototype.leave;
    $.fn.popover.Constructor.prototype.leave = function(obj){
      var self = obj instanceof this.constructor ?
        obj : $(obj.currentTarget)[this.type](this.getDelegateOptions()).data('bs.' + this.type)
      var container, timeout;

      originalLeave.call(this, obj);

      if(obj.currentTarget) {
        if (false === self.options.container) {
            container = $(obj.currentTarget).siblings('.popover')
        }
        else {
            container = $('.popover', self.options.container);
        }
        timeout = self.timeout;
        container.one('mouseenter', function(){
          //We entered the actual popover – call off the dogs
          clearTimeout(timeout);
          //Let's monitor popover content instead
          container.one('mouseleave', function(){
            $.fn.popover.Constructor.prototype.leave.call(self, self);
          });
        })
      }
    };


    $('body').popover({ 
        selector: '[data-handler="selectDay"]', 
        html: true, 
        trigger: 'click hover',
        container: 'body',
        placement: 'bottom', 
        delay: {show: 50, hide: 100},
        content: function() {
            return $(this).attr('data-original-title');
        },
        template: '<div class="popover"><div class="arrow"></div><div class="popover-content"></div></div>'
    });
    // $('body').popover({
    //     selector: '[data-handler="selectDay"]',
    //     html: true,
    //     trigger: 'hover',
    //     delay: {hide:500},
    //     container: "body",
    //     placement: "bottom",
    //     content: function() {
    //         return $(this).attr('data-original-title');
    //     },
    //     template: '<div class="popover"><div class="arrow"></div><div class="popover-content"></div></div>'
    // })

    // $('[data-handler="selectDay"]').each(function () {
    //     var $elem = $(this);
    //     $elem.popover({
    //         placement: 'top',
    //         trigger: 'hover',
    //         html: true,
    //         container: $elem
    //     });
    // });
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
        type: 'image',
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
    //categoryDropDown()
})

$(window).load(function() {
    eventBannerHeight();
    calToolTip()
    calendarWidth()
})

$(window).resize(function() {
    eventBannerHeight()
    calendarWidth()
})
