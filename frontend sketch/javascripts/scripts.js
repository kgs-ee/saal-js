
/*
** Datepicker
*/
// var availableDates = ["11-6-2015","21-6-2015","15-6-2015"];

// function available(date) {
//   dmy = date.getDate() + "-" + (date.getMonth()+1) + "-" + date.getFullYear();
//   if ($.inArray(dmy, availableDates) != -1) {
//     return [true, "","Available"];
//   } else {
//     return [false,"","unAvailable"];
//   }
// }

function toggleTooltip(options)
{
  var settings = {
    show : true,
    content : '',
    effect : '',
    align : ''
  };  
  $.extend(settings, options);
  if (settings.content)
    $('#tooltip-content').html(settings.content);
  var $tooltip = $('#tooltip');
  $tooltip.stop();
  if (settings.show) {
    if (settings.effect == 'fade') {
      $tooltip.fadeTo(200, 1);
    } else {
      $tooltip.show();
    }
    $(document).bind('mousemove', {settings: settings}, followTooltip);
  } else {
    if (settings.effect == 'fade') {
      $tooltip.fadeTo(200, 0);
    } else {
      $tooltip.hide();
    }
    $(document).unbind('mousemove', followTooltip);
  } 
}

function followTooltip(e)
{
  var $tooltip = $('#tooltip');
  var width = $tooltip.width();
  var left = (e.pageX - $tooltip.width() - 25);

  if (left < 10) {
    left = e.pageX;
  }
  $tooltip.css({
    'top' : (e.pageY + 20) + "px",
    'left' : left + "px",
    'width' : 'auto'
  });
  /*
  if (e.pageX + width > $(window).width() && !e.data.settings.align == "right") {
    $tooltip.css('right', e.pageX - width - 15).css('top', e.pageY - 55);
  } else {
    $tooltip.css('right', e.pageX+15).css('top', e.pageY - 55);
  }*/
}


function eventBannerHeight() {
  windowHeight = $(window).height();
  navHeight = $('.navbar-default').outerHeight(true);

  $(".event-banner figure").height(windowHeight - navHeight);
}

function categoryDropDown() {
  var options = [];

  $( '.dropdown-menu a' ).on( 'click', function( event ) {

     var $target = $( event.currentTarget ),
         val = $target.attr( 'data-value' ),
         $inp = $target.find( 'input' ),
         idx;

     if ( ( idx = options.indexOf( val ) ) > -1 ) {
        options.splice( idx, 1 );
        setTimeout( function() { $inp.prop( 'checked', false ) }, 0);
     } else {
        options.push( val );
        setTimeout( function() { $inp.prop( 'checked', true ) }, 0);
     }

     $( event.target ).blur();
        
     console.log( options );
     return false;
  });
}

/*
**  Google Maps
*/
function initMap() {
  var myLatlng = new google.maps.LatLng(59.438552,24.745975);
  
  var mapOptions = {
    center: myLatlng,
    zoom: 18
  };

  var map = new google.maps.Map(document.getElementById('map'),
  mapOptions);

  var marker = new google.maps.Marker({
      position: myLatlng,
      map: map,
      title: 'Kanuti Gildi Saal'
  });

}

$(document).ready(function() {

  var options = $.extend(
      {},
      $.datepicker.regional["et"],
      { dateFormat: "d MM, y" }
  );
  $.datepicker.setDefaults(options);

  // $( "#datepicker").datepicker({
  //   beforeShowDay: available,
  //   prevText: '<',
  //   nextText: '>',
  //   weekStart: 1
  // });

var arrEvents = {};
var currentTitle = "";

  
  $.getJSON('http://kgs-ee.github.io/saal-js/javascripts/campo-json.json', function(response){

    for (var key in response) {
      //console.log(key);
      var keys = key.split("-");
      var d = new Date(keys[0], keys[1] - 1, keys[2]);
      arrEvents[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = response[key];
      //console.log(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
    }
    
    //$("#datepicker").html("");
    $("#datepicker").datepicker({
      dateFormat : "yy-mm-dd",
      prevText : '<',
      nextText : '>',
      onChangeMonthYear: function(year, month, inst) {
        // hack default behaviour.
        setTimeout(function(){
          toggleTooltip({show:false});
        }, 0);
      },
      onSelect: function(dateText, inst) {
        //console.log(dateText);
        var parts = dateText.split("-");
        //console.log(parts);
        var clickedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        //var clickedDate = new Date(dateText);
        var dateString = clickedDate.getFullYear() + "-" + (clickedDate.getMonth() + 1) + "-" + clickedDate.getDate();
        var eventsByDate = arrEvents[dateString];
        var urlTo = "";
        
        if (eventsByDate.length > 1) {
          urlTo = eventsByDate[0].multiUrl;
        } else {
          urlTo = eventsByDate[0].url;
        }
        window.location = urlTo;
      },
      beforeShowDay: function(date) {
        
        var dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
        
        //console.log(dateString);
        //console.log(arrEvents);
        //console.log(arrEvents["2012-9-29"]);
        var eventsByDate = arrEvents[dateString];
        
        var isClickable = false;
        var extraClass = "";
        var tooltip = null;
        
        if (eventsByDate) {
          isClickable = true;
          extraClass = "highlight";
          if (eventsByDate.length > 1) {
            extraClass += " multiple"
          } 
          tooltip = "<ul class='list-unstyled'>";
          for (var e in eventsByDate) {
            var event = eventsByDate[e];
            /*console.log(event);*/
            extraClass += " " + event.extraClasses;
            var time = (event.time != "00:00") ? (event.time + " uur ") : "";
            /*tooltip += "<li class='" + event.extraClasses + "'>" + time + ": "  + event.name + ((event.short) ? (" - " + event.short) : "") + "</li>";*/
            tooltip += "<li class='" + event.extraClasses + "'>";
              tooltip += event.name + ((event.short) ? (" - " + event.short) : "") + "<br />";
              tooltip += event.client + ((event.city) ? (" - " + event.city) : "");
              //tooltip += event.name + ((event.short) ? (" - " + event.short) : "") + "<br />";
            
            tooltip += "</li>";
          }
          tooltip += "</ul>";
        }
        return [isClickable, extraClass, tooltip]
      }
    });
  });


  $('.highlight').tooltip();

  $(".fancybox").fancybox({
    padding: 0,
    helpers: {
        overlay: {
          locked: false
        }
      }
  });

  $(".main-text").shorten({
    moreText: 'Loe edasi',
    lessText: 'Loe vähem',
    showChars: '1000'
  });

  //$("#datepicker-container").draggable();
  
  // eventBannerHeight();
  //initMap();
  categoryDropDown();
});

$(window).on("load resize",function(){
    eventBannerHeight();

    $('.highlight').tooltip({
      html: true,
      container: "body",
      placement: "bottom"
    });

    $('.highlight').attr("data-toggle", "tooltip");
});
