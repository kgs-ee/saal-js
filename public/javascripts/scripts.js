/**
**  Events to datepicker
*/
function datePickerInit() {
    var baseHref = document.getElementsByTagName('base')[0].getAttribute("href")
    var locale = baseHref.split('/')[1]

    var options = $.extend(
        {},
        $.datepicker.regional[locale],
        { dateFormat: "d MM, y" }
    )
    $.datepicker.setDefaults(options)

    $.getJSON('calendar_json', function(response){

        $("#datepicker").datepicker({
            dateFormat : "yy-mm-dd",
            prevText : '<',
            nextText : '>',
            minDate : response.minDate,
            maxDate : response.maxDate,

            beforeShowDay: function(date) {

                var dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
                var eventsByDate = response.events[dateString]

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
                        var tag = event.tag.join(" ")

                        tooltip += "<li class='"
                            + tag + "'><a href='"
                            + event.controller + '/'
                            + event.eid + "'>"
                            + event.time + " / <span class='artist'>"
                            + event['name'][locale] + "</span> / "
                            + event['location'][locale] + "</a></li>"

                        tooltip += "</li>"
                        extraClass += " " + tag
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
}


/**
**  Frontpage slider height
*/
function eventBannerHeight() {
    var windowHeight = $(window).height()
    var navHeight = $('.navbar-default').outerHeight()

    $(".event-banner figure").height(windowHeight - navHeight - 80)
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
                locked: false,
                css : {
			        'background' : 'rgba(0, 0, 0, 0.8)'
			    }
            }
        }
    })
}


$(document).ready(function() {
    datePickerInit()
    calToolTip()
    fancyBoxGallery()
    eventBannerHeight()

    // Prevent linking to front page
    $('.festivals .dropdown-menu a').click(function(event) {
        event.preventDefault();
    });
})

$(window).load(function() {
    calToolTip()
    calendarWidth()
})

$(window).resize(function() {
    eventBannerHeight()
    calendarWidth()
})
