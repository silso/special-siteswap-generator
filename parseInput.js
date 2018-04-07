'use strict';

//TODO: (maybe) instead of destroying sliders in resetLadder, delete handles. this way functions aren't redefined each time ladder is reset
//TODO: make slider handle value not on slider (by appending an element)
//TODO: give ladder lines colors based on the loop they are in

//temporary global to figure out animation stuff
var preset;
var animationInstance;

$(document).ready(function() {
	//misc initializations
	var site,
		siteswapForm = document.getElementById('siteswapForm');

	//<editor-fold> PRESET DEFINITION *******************************************
	var Preset = function(site) {
		//this class holds the config of the siteswap, including rhythm.
		var repeats = document.getElementById('repeatCount').value; //get # of repeats from spinner

		this.site = site; //siteswap object
		this.throwInfo = site.printThrowInfo(repeats); //such terrible names, idk. this has info about where lines go
		this.beats = {left: [], right: []}; //rhythm of this instance of a siteswap
		this.throwTime = 0.7; //starting value for dwell (in slider length units)
		this.dwellLimit = .4; //smallest allowed value for dwell time (default dwell time is 1 - throwTime)
		this.throwLimit = .25; //smallest allowed value to throw one ball then catch a different ball in the same hand
		this.speedLimit = .4; //smallest allowed value to throw a ball to the other hand (maybe shouldn't have this or throwLimit, doesn't make a ton of sense physically)
		this.makeBeats();
		this.makeColors();
	}
	Preset.prototype.makeBeats = function() {
		//makes an object with two arrays: the beat times of catches and throws for each hand. Catches are even, throws are odd
		this.beats = {left: [], right: []};
		this.beats.left.push(0);
		var syncDiff = !this.site.sync; //make right hand throws 1 beat out of sync with left hand when pattern isn't sync
		for (let i = 2; i <= this.throwInfo.endTime; i += 2) {
			this.beats.left.push(i - 1 + this.throwTime); //left hand catch time
			this.beats.left.push(i); //left hand throw time
			this.beats.right.push(i - syncDiff - 1 + this.throwTime); //right hand catch time
			this.beats.right.push(i - syncDiff); //right hand throw time
		}

		// console.log(this.beats);
	}
	Preset.prototype.makeThrowInfo = function(repeats) {
		this.throwInfo = site.printThrowInfo(repeats);
	}
	Preset.prototype.makeColors = function() {
		this.colors = [];
		for (let i = 0; i < this.site.loops.length; i++) {
			this.colors.push("rgb(" + Math.floor(Math.random()*192 + 32) + "," + Math.floor(Math.random()*192 + 32) + "," + Math.floor(Math.random()*192 + 32) + ")");
		}
	}
	//</editor-fold> PRESET DEFINITION ******************************************

	//<editor-fold> INPUT *******************************************************
	siteswapForm.onsubmit = function(e) {
		e.preventDefault();
		parseInput();

      animationInstance = undefined;
      animationInstance = new AnimationScript();
      animationInstance.init(preset, false);
	}

	//create siteswap and preset objects from entry
	var parseInput = function() {
		//SYNTAX CHECKER
		//Modified (stolen) from gunswap.co
		var input = document.getElementById('siteswapInput');
		var siteString = input.value.toLowerCase();
		var TOSS = '(\\d|[a-w])';
		var MULTIPLEX = '(\\[(\\d|[a-w])+\\])';
		var SYNCMULTIPLEX = '(\\[((\\d|[a-w])x?)+\\])';
		var SYNC = '\\(((' + TOSS + 'x?)|' + SYNCMULTIPLEX + '),((' + TOSS + 'x?)|' + SYNCMULTIPLEX + ')\\)';
		var PATTERN = new RegExp('^(' + TOSS + '|' + MULTIPLEX + ')+$|^(' + SYNC + ')+\\*?$');

		var error = document.getElementById('siteswapEntryError');
		if(!PATTERN.test(siteString)) {
			error.innerHTML = 'Invalid syntax';
			error.classList.add('siteswapEntryErrorInvalid');
		}
		else {
			site = new Siteswap(String(siteString));
			if (!site.valid) {
				error.innerHTML = 'Invalid pattern';
				error.classList.add('siteswapEntryErrorInvalid');
			}
			else if (!site.site[0]) {
				error.innerHTML = '0 at start=bad';
				error.classList.add('siteswapEntryErrorInvalid');
			}
			else { //if pattern valid
				error.innerHTML = '';
				error.classList.remove('siteswapEntryErrorInvalid');
				preset = new Preset(site);

				console.log('siteswap array:', site.printArray());
				console.table({
					'valid': site.isValid(),
					'siteswap': site.printSite(),
					'loops': site.printLoops(),
					'looptime': site.printLoopTime()
				});
				console.log('throwInfo: ', preset.throwInfo);
				console.log('beats: ', preset.beats);

				resetLadder();
			}
		}
	}
	//</editor-fold> SITESWAP ENTRY *********************************************

	//intialize tabs
	$('#tabs').tabs();
	//disable ladder tab until preset is entered
	$('#tabs').tabs('disable', '#ladderDiagram');
	//allow resizing of user entry
	$('#userEntryWrapper').resizable({
		handles: 'e',
		minWidth: 310
	});

	//<editor-fold> LADDER DIAGRAM **********************************************
	//initialize repeat count selector
	$('#repeatCount').spinner();

	//initialize reset button
	$('#resetLadder').click(function() {
		try {
			var repeats = document.getElementById('repeatCount').value;
			preset.makeThrowInfo(repeats);
			preset.makeBeats();
			resetLadder();
		}
		catch(e) {
			console.log('no preset');
		}
	});

	//<editor-fold> SLIDER FUNCS ************************************************
	$('.slider').slider({orientation: 'vertical'}); //initialize sliders
	var restrictHandleMovement = function(preset, ui, slider, isLeft) {
		var handleIndex = ui.handleIndex, //handle number, starting with 0 from bottom, index is same in beats
			value = ui.value,
			newValue = ui.value,
			beats = isLeft ? preset.beats.left : preset.beats.right,
			otherBeats = isLeft ? preset.beats.right : preset.beats.left,
			throwArray = preset.throwInfo.throws,
			dwellLimit = preset.dwellLimit, //shortest time you can hold the ball for
			throwLimit = preset.throwLimit, //shortest time you can throw a ball then catch another
			speedLimit = preset.speedLimit, //shortest time you can throw a ball to the other hand
			lowerLimit = 0,
			upperLimit = preset.throwInfo.endTime,
			endTime = preset.throwInfo.endTime,
			isThrow = (handleIndex % 2) ^ isLeft; //right hand throws are offset by one, so isLeft takes that into account

		//Find limits of handle
		//first set limits to neighboring handles: most common case
		if (handleIndex > 0) { //exclude bottom handle, already limited by slider
			lowerLimit = beats[handleIndex - 1] + (isThrow ? throwLimit : dwellLimit);
		}
		if (isLeft || handleIndex < beats.length - 1) { //every movable left handle has handle above, top right handle already limited by slider
			upperLimit = beats[handleIndex + 1] - (isThrow ? dwellLimit : throwLimit);
		}

		// sometimes, however, they are limited by the hand throwing to it/they are throwing to (this is always true for 1 throws)
		// also sometimes, we are limiting our throws with invisible zero throw handles. We want to avoid this
		if (isThrow) { //throw handle (will set upper limit)
			//first, we find the nearest non-zero handle above this throw
			var upperIndex = handleIndex + 2;
			for (let i = 0; i < throwArray.length; i++) {
				if (throwArray[i].end == upperIndex) {
					if (throwArray[i].start == throwArray[i].end) {
						upperIndex += 2;
						upperLimit = beats[upperIndex];
						i = 0;
					}
				}
			}

			//find nearest connected catch handle. we have to use for loops because there could be multiplexes
			for (let i = 0; i < throwArray.length; i++) { //find throws that this handle matches
				if (throwArray[i].start == handleIndex) {
					//first part of following if is to make sure we wont index out of beats
					if (throwArray[i].end <= preset.throwInfo.endTime && otherBeats[throwArray[i].end - 1] - speedLimit < upperLimit) { //in case there was a multiplex, we want to ensure it is the shortest throw
						upperLimit = otherBeats[throwArray[i].end - 1] - speedLimit;
					}
				}
			}
		} else { //catch handle (will set lower limit)
			//first, we find the nearest non-zero handle below this throw
			var lowerIndex = handleIndex - 1;
			for (let i = 0; i < throwArray.length; i++) {
				if (throwArray[i].start == lowerIndex) {
					if (throwArray[i].start == throwArray[i].end) {
						lowerIndex -= 2;
						lowerLimit = beats[lowerIndex];
						i = 0;
					}
				}
			}

			for (let i = 0; i < throwArray.length; i++) { //same deal as above
				if (throwArray[i].end == handleIndex + 1) { //+1 since the catch handle seen the same as the throw handle above it in throwArray
					if (otherBeats[throwArray[i].start] + speedLimit > lowerLimit) { //dont have to do check like above since start is always inside the ladder
						lowerLimit = otherBeats[throwArray[i].start] + speedLimit;
					}
				}
			}
		}

		//get rid of slider text
		slider.find('.ui-slider-handle').text((''));

		//if out of bounds, set value to the limit
		if (value > upperLimit) {
			slider.slider('values', handleIndex, upperLimit);
			newValue = upperLimit;
		}
		if (value < lowerLimit) {
			slider.slider('values', handleIndex, lowerLimit);
			newValue = lowerLimit;
		}

		//store new value in beats
		if (isThrow) {
			beats[handleIndex] = newValue;
		} else {
			beats[handleIndex] = newValue;
		}
	}

	//stolen from here, updated:
	//https://stackoverflow.com/questions/16152033/jquery-ui-slider-trying-to-disable-individual-handles
	$.widget("ui.slider", $.ui.slider, {
		_mouseCapture: function(event) {
			var position, normValue, distance, closestHandle, index, allowed, offset, mouseOverHandle,
				that = this,
				o = this.options;

			if (o.disabled) {
				return false;
			}

			this.elementSize = {
				width: this.element.outerWidth(),
				height: this.element.outerHeight()
			};
			this.elementOffset = this.element.offset();

			position = {
				x: event.pageX,
				y: event.pageY
			};
			normValue = this._normValueFromMouse(position);
			distance = this._valueMax() - this._valueMin() + 1;
			this.handles.each(function(i) {
				// Added condition to skip closestHandle test if this handle is disabled.
				// This prevents disabled handles from being moved or selected.
				if (!$(this).hasClass("ui-slider-handle-disabled")) {
					var thisDistance = Math.abs(normValue - that.values(i));
					if ((distance > thisDistance) || (distance === thisDistance && (i === that._lastChangedValue || that.values(i) === o.min))) {
						distance = thisDistance;
						closestHandle = $(this);
						index = i;
					}
				}
			});

			// Added check to exit gracefully if, for some reason, all handles are disabled
			if (typeof closestHandle === 'undefined')
				return false;

			allowed = this._start(event, index);
			if (allowed === false) {
				return false;
			}
			this._mouseSliding = true;

			this._handleIndex = index;

			this._addClass(closestHandle, null, "ui-state-active");
			closestHandle.trigger('focus');

			offset = closestHandle.offset();
			// Added extra condition to check if the handle currently under the mouse cursor is disabled.
			// This ensures that if a disabled handle is clicked, the nearest handle will remain under the mouse cursor while dragged.
			mouseOverHandle = !$(event.target).parents().addBack().is(".ui-slider-handle") || $(event.target).parents().addBack().is(".ui-slider-handle-disabled");
			this._clickOffset = mouseOverHandle ? {
				left: 0,
				top: 0
			} : {
				left: event.pageX - offset.left - (closestHandle.width() / 2),
				top: event.pageY - offset.top - (closestHandle.height() / 2) -
					(parseInt(closestHandle.css("borderTopWidth"), 10) || 0) -
					(parseInt(closestHandle.css("borderBottomWidth"), 10) || 0) +
					(parseInt(closestHandle.css("marginTop"), 10) || 0)
			};

			if (!this.handles.hasClass("ui-state-hover")) {
				this._slide(event, index, normValue);
			}
			this._animateOff = true;
			return true;
		}
	});
	//</editor-fold> SLIDER FUNCS ***********************************************

	//<editor-fold> CANVAS FUNCS ************************************************
	//canvas initializations
	var c = document.getElementById('ladderLines'); //initialize canvas
	var ctx = c.getContext('2d');
	c.height = $('#sliders').height() - 2; //same size as sliders, but accounting for border
	c.width = $('#sliders').width() - 2;
	var marginTop = parseInt($('#leftSlider').css('marginTop')) + 1; //+1 for border
	var marginSide = parseInt($('#leftSlider').css('marginLeft')) + 4; //+4 for border and inside width

	//fills canvasLines array with start and end points on the canvas
	var updateCanvasLines = function(preset, canvas, marginSide, sizeRatio) {
		var endTime = preset.throwInfo.endTime;
		var canvasLines = [];
		var zeroThrows = new Array(endTime / 2).fill(0);
		//coordinate conversion, needs to know where y slider is (marginSide) and conversion between canvas pixels and slider values (sizeRatio)
		var coordinateFinder = function(throwNum, isLeft, marginSide, sizeRatio) { //isThrow should be 1 or 0
			if (isLeft) {
				return {
					x: 0,
					y: throwNum * sizeRatio
				};
			}
			return {
				x: marginSide * 2,
				y: throwNum * sizeRatio
			};
		}

		//fill canvasLines array with pixel start and pixel end coords, as well as info about the throw
		for (let i = 0; i < preset.throwInfo.throws.length; i++) {
			var curThrow = preset.throwInfo.throws[i]; //curThrow has start and end
			//when start is odd, it is right hand, so select from right array
			//within the array, select appropriate beat value. use endTime + 1 because the first beat is repeated at the top and bottom
			var start = (curThrow.start % 2 ? preset.beats.right : preset.beats.left)[curThrow.start % (endTime + 1)];
			var end = (curThrow.end % 2 ? preset.beats.right : preset.beats.left)[(curThrow.end - 1) % endTime];
			//curThrow.start is throw number without its position on slider, so we have to use preset.beats as well
			//same goes for .end, with +5 since the catch node is on the previous throw
			//(eg the catch for 7 is at time 6.9, which is on throw 6). also we dont want to mod negative nums so we add 6 (-1 + 6 = 5).
			var coords = coordinateFinder(start, !(curThrow.start % 2), marginSide, sizeRatio),
				nextCoords = coordinateFinder(end, curThrow.start % 2, marginSide, sizeRatio),
				odd = true,
				left = true;

			if (curThrow.start == curThrow.end) { //dont draw those silly 0 throws
				zeroThrows[(curThrow.start - 1) % endTime] = 1;
				continue;
			}

			if (!((curThrow.end - curThrow.start) % 2)) {
				odd = false; //throw lands in same hand its thrown from
				if (curThrow.start % 2) {
					left = false; //whether this line is on the left slider
				}
			}

			if (curThrow.start < curThrow.end % (preset.throwInfo.endTime + 1)) { //if line doesnt go off chart (+1 so we can still draw to node at the end of diagram)
				canvasLines.push({
					coords: coords,
					nextCoords: nextCoords,
					odd: odd,
					left: left,
					throw: true //this is not a dwell line but a throw line
				});
			} else {
				canvasLines.push({ //draw two lines, one going off bottom of canvas
					coords: {
						x: coords.x,
						y: coords.y - canvas.height
					},
					nextCoords: nextCoords,
					odd: odd,
					left: left,
					throw: true
				});
				canvasLines.push({ //and other going off the top of canvas
					coords: coords,
					nextCoords: {
						x: nextCoords.x,
						y: nextCoords.y + canvas.height
					},
					odd: odd,
					left: left,
					throw: true
				});
			}
		}

		//push catch lines, excluding zero throws
		for (let i = 2; i <= endTime; i += 2) {
			if (!zeroThrows[i - 1]) { //right hand dwells
				canvasLines.push({
					coords: coordinateFinder(preset.beats.right[i - 2], false, marginSide, sizeRatio),
					nextCoords: coordinateFinder(preset.beats.right[i - 1], false, marginSide, sizeRatio),
					odd: true, //odd so it draws straight lines
					left: true,
					throw: false
				});
			}
			if (!zeroThrows[i]) { //left hand dwells
				canvasLines.push({
					coords: coordinateFinder(preset.beats.left[i - 1], true, marginSide, sizeRatio),
					nextCoords: coordinateFinder(preset.beats.left[i], true, marginSide, sizeRatio),
					odd: true, //odd so it draws straight lines
					left: true,
					throw: false
				});
			}
		}

		//draw canvas lines
		(function() {
			ctx.clearRect(-100, -100, c.width + 100, c.height + 100);
			//draw throw lines
			for (let i = 0; i < canvasLines.length; i++) {
				ctx.beginPath();
				if (canvasLines[i].throw) {
					ctx.lineWidth = 3;
					var coords = {
							x: canvasLines[i].coords.x,
							y: canvasLines[i].coords.y
						},
						nextCoords = {
							x: canvasLines[i].nextCoords.x,
							y: canvasLines[i].nextCoords.y
						};

					ctx.moveTo(coords.x, coords.y);
					if (canvasLines[i].odd) {
						ctx.lineTo(nextCoords.x, nextCoords.y);
					} else {
						var offset = 40; //(nextCoords.y - coords.y) * 0.05; //how far the even throws go from sliders
						if (canvasLines[i].left) {
							ctx.bezierCurveTo(coords.x + offset, coords.y, coords.x + offset, nextCoords.y, coords.x, nextCoords.y);
						} else {
							ctx.bezierCurveTo(coords.x - offset, coords.y, coords.x - offset, nextCoords.y, coords.x, nextCoords.y);
						}
					}
				}
				else {
					var coords = {
							x: canvasLines[i].coords.x,
							y: canvasLines[i].coords.y
						},
						nextCoords = {
							x: canvasLines[i].nextCoords.x,
							y: canvasLines[i].nextCoords.y
						};

					ctx.moveTo(coords.x, coords.y);
					ctx.lineWidth = 8;
					ctx.lineTo(nextCoords.x, nextCoords.y);
				}

				ctx.stroke();
			}
		})();

	}
	//</editor-fold> CANVAS FUNCS ***********************************************

	var resetLadder = function() {

		$('#tabs').tabs('enable', '#ladderDiagram');

		//<editor-fold> SLIDER STUFF *********************************************
		preset.makeBeats();
		//create arrays of values which will represent starting handle positions on the sliders
		var leftNodes = preset.beats.left,
			rightNodes = preset.beats.right;

		//must destroy old sliders so extra handles get added when necessary
		$('.slider').slider('destroy');

		//left slider creation
		$('#leftSlider').slider({
			orientation: 'vertical',
			step: 0.05,
			min: 0,
			max: preset.throwInfo.endTime,
			values: leftNodes,
			//i can either add a static handle to the top here, or add a weird element to the beats array
			//leftNodes.map(a => a.start).concat(leftNodes.map(a => a.end)).sort().concat([preset.throwInfo.endTime])

			create: function(ev, ui) {
				//disable t=0 and t=max handle, these handles restrict the time it takes the repeat
				$('#leftSlider').find('.ui-slider-handle:first').addClass('ui-slider-handle-disabled');
				$('#leftSlider').find('.ui-slider-handle:last').addClass('ui-slider-handle-disabled');
				//disable 0 catches
            for (let i = 0; i < preset.throwInfo.throws.length; i++) {
					var curThrow = preset.throwInfo.throws[i];
               if (curThrow.start == curThrow.end) { //if zero throw
						if (!(curThrow.start % 2)) { //if on left slider
							$('#leftSlider span:nth-child(' + curThrow.start + ')').addClass('ui-slider-handle-disabled'); //disable nth and nth + 1 handles
							document.querySelector('#leftSlider span:nth-child(' + curThrow.start + ')').style.display = 'none';
							$('#leftSlider span:nth-child(' + parseInt(curThrow.start + 1) + ')').addClass('ui-slider-handle-disabled');
							document.querySelector('#leftSlider span:nth-child(' + parseInt(curThrow.start + 1) + ')').style.display = 'none';
						}
               }
            }
				//console.log($('#leftSlider').slider('values'));
			},

			slide: function(ev, ui) {
				//show slider value when sliding
				$('#leftSlider').find('.ui-state-active')
					.text($('#leftSlider').slider('values', ui.handleIndex));

				//store current in beats (if it is out of range, it will be set appropriately with stop function. this just moves lines with handles)
				preset.beats.left[ui.handleIndex] = ui.value;

				updateCanvasLines(preset, c, marginSide, sizeRatio);
			},

			stop: function(ev, ui) { //when you stop moving the handle, it jumps to valid bounds
				restrictHandleMovement(preset, ui, $('#leftSlider'), true);
				updateCanvasLines(preset, c, marginSide, sizeRatio);

				animationInstance.generateMovements(preset, false);
			}
		});

		//right slider creation
		$('#rightSlider').slider({
			orientation: 'vertical',
			step: 0.05,
			min: 0,
			max: preset.throwInfo.endTime,
			values: rightNodes,

			create: function(ev, ui) {
				//disable 0 catches
				for (let i = 0; i < preset.throwInfo.throws.length; i++) {
					var curThrow = preset.throwInfo.throws[i];
					if (curThrow.start == curThrow.end) { //if zero throw
						if (curThrow.start % 2) { //if on right slider
							$('#rightSlider span:nth-child(' + curThrow.start + ')').addClass('ui-slider-handle-disabled'); //disable nth and nth + 1 handles
							document.querySelector('#rightSlider span:nth-child(' + curThrow.start + ')').style.display = 'none';
							$('#rightSlider span:nth-child(' + parseInt(curThrow.start + 1) + ')').addClass('ui-slider-handle-disabled');
							document.querySelector('#rightSlider span:nth-child(' + parseInt(curThrow.start + 1) + ')').style.display = 'none';
						}
					}
				}
			},

			slide: function(ev, ui) {
				//show slider value when sliding
				$('#rightSlider').find('.ui-state-active')
					.text($('#rightSlider').slider('values', ui.handleIndex));

				//store current in beats (if it is out of range, it will be set appropriately with stop function. this is just for lines)
				preset.beats.right[ui.handleIndex] = ui.value;

				updateCanvasLines(preset, c, marginSide, sizeRatio);
			},

			stop: function(ev, ui) { //when you stop moving the handle, it jumps to valid bounds
				restrictHandleMovement(preset, ui, $('#rightSlider'), false);
				updateCanvasLines(preset, c, marginSide, sizeRatio);

				animationInstance.generateMovements(preset, false);
			}
		});

		document.querySelectorAll('.ui-slider-handle').forEach(function(a) {
			a.onclick = function(e) {
				e.preventDefault();
				//console.log(this);
			}
		});
		//</editor-fold> SLIDER STUFF ********************************************

		//<editor-fold> CANVAS STUFF *********************************************
		var sizeRatio;
		var updateCanvasSize = function() {
			c.height = $('#tabs').height() - $('#tabNames').height() - 50;
			c.width = $('#tabs').width();
			sizeRatio = c.height / preset.throwInfo.endTime;

			ctx.resetTransform();
			ctx.transform(1, 0, 0, -1, marginSide, c.height - marginTop);

			updateCanvasLines(preset, c, marginSide, sizeRatio);
		}
		window.onresize = updateCanvasSize; //change canvas size when height changes
		updateCanvasSize(); //this updates sizeRatio and transforms canvas context
		if (animationInstance !== undefined) animationInstance.generateMovements(preset, false);
		//</editor-fold> CANVAS STUFF ********************************************
	};

	//</editor-fold> LADDER DIAGRAM *********************************************
	//</editor-fold> INPUT ******************************************************
});
