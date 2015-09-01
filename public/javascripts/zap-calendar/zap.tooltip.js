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