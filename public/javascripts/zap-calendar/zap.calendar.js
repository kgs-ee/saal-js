var arrEvents = {};
var currentTitle = "";
$(function(){

	var locale = Zap.langId;
	locale = locale + ((locale == "en") ? "-GB" : "");
	$.datepicker.setDefaults( $.datepicker.regional[ locale ] );
	
	$.get('/ajax/get-events-calendar', 'locale=' + Zap.langId, function(response){

		var data = $.parseJSON(response);
		for (var key in data) {
			//console.log(key);
			var keys = key.split("-");
			var d = new Date(keys[0], keys[1] - 1, keys[2]);
			arrEvents[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = data[key];
			//console.log(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
		}
		
		$("#event-calendar").html("");
		$("#event-calendar").datepicker({
			dateFormat : "yy-mm-dd",
			minDate : Zap.seasonStart,
			maxDate : Zap.seasonEnd,
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
					tooltip = "<ul>";
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
		
		$('td.highlight:not(.ui-datepicker-unselectable)').live("mouseenter", 
			function(evt){
				evt.preventDefault();
				currentTitle = $(this).attr('title');
				$(this).attr('title', '');
				toggleTooltip({
					content : currentTitle,
					effect : 'fade'
				});
			}
		);
		$('td.highlight:not(.ui-datepicker-unselectable)').live("mouseleave",
			function(evt){
				evt.preventDefault();
				toggleTooltip({show : false});
				$(this).attr('title', currentTitle);
			}
		);
		$(window).trigger('resize');
	})
});