// Copyright 2013 Barend Scholtus
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//
// Represents a Cosmac Elf computer.
//

var CosmacElfObj = function(canvas, ctx, offImg, onImg, ledOnImg, hexImg) {
	
	this.canvas = canvas;
	this.ctx = ctx;
	this.offImg = offImg;
	this.onImg = onImg;
	this.ledOnImg = ledOnImg;
	this.hexImg = hexImg;
	
	//
	// COMPUTER RELATED VARIABLES
	//
	
	// the CPU
	this.cpu = new Cdp1802Obj(this);
	
	// the memory
	this.memory = new Array();
	this.memory.length = 256;
	
	// clock frequency (should be between 1-2 MHz)
	// 8 clocks are required for 1 machine cycle
	this.clockFreq = 1760640;
	
	// the hex value being displayed
	this.display = 0;
	
	// state of the led, based on the Q output from the CPU
	this.led = false;

	// state of the 12 inputs
	this.switchState = [ false, false, false, false, false, false, false, false, false, false, false, false ];

	// reset CPU
	this.cpu.reset();
	
	//
	// USER INTERFACE RELATED VARIABLES
	//
	
	// animation related
	this.fps = 60;
	this.interval = 1000 / this.fps;
	
	// number of machine cycles per frame
	// most CPU instructions require 2 machine cycles
	this.cyclesPerFrame = this.clockFreq / 8 / this.fps;

	// location and dimension of switches, display, and LED
	this.switchX = [ 351, 307, 264, 222, 180, 138,  95,  52, 350, 307, 100,  65 ];
	this.switchY = [ 333, 333, 333, 333, 333, 333, 333, 333, 268, 268, 268, 305 ];
	this.switchOnY = [ 65, 65, 65, 65, 65, 65, 65, 65, 0, 0, 0, 37 ];
	this.switchW = [ 42, 44, 43, 42, 42, 42, 43, 43, 40, 41, 40, 28 ];
	this.switchH = [ 66, 66, 66, 66, 66, 66, 66, 66, 65, 65, 65, 26 ];
	this.switchDirty = [ false, false, false, false, false, false, false, false, false, false, false, false ];

	this.display1X = 233;
	this.display2X = 205;
	this.displayY = 222;
	this.displayW = 17;
	this.displayH = 23;
	this.displayDirty = false;

	this.ledX = 222;
	this.ledY = 175;
	this.ledW = 13;
	this.ledH = 17;
	this.ledDirty = false;

	// key map binding keys to switches
	// get event.which scancodes from http://api.jquery.com/keydown/
	this.inButtonKey = 32;   // space -> in
	this.keyMap = {
		186: 0, // ; -> switch 0 (for IE/chrome)
		59: 0,  // ;             (for mozilla)
		76: 1,  // L -> switch 1
		75: 2,  // K -> switch 2
		74: 3,  // J -> switch 3
		70: 4,  // F -> switch 4
		68: 5,  // D -> switch 5
		83: 6,  // S -> switch 6
		65: 7,  // A -> switch 7
		13: 8,  // ENTER -> run
		72: 9,  // H -> mp
		71: 10  // G -> load
	};
	
	// install event handlers
	this.installEventHandlers();
};

//
// EMULATOR PROTOTYPES
//

// Sets the output flip-flop Q from the CPU
CosmacElfObj.prototype.setQ = function(q) {
	this.ledDirty = this.ledDirty || (this.led != q);
	this.led = q;
}

// Reads a byte from memory
CosmacElfObj.prototype.read = function(address) { //16 bit unsigned
	if (address >= 0 && address < this.memory.length) {
		return this.memory[address];
	}
	return 0;
}

// Write a byte to memory
CosmacElfObj.prototype.write = function(address, data) { //16 bit unsigned address
	if (!this.switchState[9] && address >= 0 && address < this.memory.length) {
		this.memory[address] = data;
	}
	this.display = this.read(address);
	this.displayDirty = true;
}

// The CPU uses this to input 8-bit unsigned data from the system bus
CosmacElfObj.prototype.input = function(nlines) { //Nlines = 1-7
	if (nlines == 4) {
		var data = 0;
		for (var i = 0; i < 8; i++) {
			data |= (this.switchState[i] ? 1 : 0) << i;
		}
		return data;
	}
	return 0;
}

// The CPU uses this to output data onto the system bus
CosmacElfObj.prototype.output = function(nlines, bus) { //Nlines = 1-7, bus=8-bit unsigned
	if (nlines == 4) {
		this.display = bus;
		this.displayDirty = displayDirty || display != bus;
	}
}

// The CPU uses this to get 1-bit External Flags EF1-EF4
CosmacElfObj.prototype.getEF1 = function() { return false; }
CosmacElfObj.prototype.getEF2 = function() { return false; }
CosmacElfObj.prototype.getEF3 = function() { return false; }
CosmacElfObj.prototype.getEF4 = function() { return this.switchState[11]; }
	
//
// USER INTERFACE RELATED PROTOTYPES
//

// emulation loop running at approx. fps
CosmacElfObj.prototype.emulate = function() {
	var emu = this;
	setTimeout(function() {
		window.requestAnimationFrame(function() { emu.emulate() });
		emu.update();
		emu.draw();
	}, this.interval);
}

// update machine state
CosmacElfObj.prototype.update = function() {
	if (this.switchState[8] && !this.switchState[10]) { // Run but not Load
		var cycles = this.cyclesPerFrame;
		while (cycles > 0) {
			cycles -= this.cpu.instruction();
		}
	}
}

// update user interface
CosmacElfObj.prototype.draw = function() {
	for (var i=0; i<this.switchDirty.length; i++) {
		if (this.switchDirty[i]) {
			this.switchDirty[i] = false;
			
			if (this.switchState[i]) {
				this.ctx.drawImage(this.onImg,
						this.switchX[i], this.switchOnY[i], this.switchW[i], this.switchH[i], 
						this.switchX[i], this.switchY[i], this.switchW[i], this.switchH[i]);
			} else {
				this.ctx.drawImage(this.offImg,
						this.switchX[i], this.switchY[i], this.switchW[i], this.switchH[i], 
						this.switchX[i], this.switchY[i], this.switchW[i], this.switchH[i]);
			}
		}
	}
	
	if (this.displayDirty) {
		this.displayDirty = false;

		var n = this.display & 0x0f;
		var i = this.display >> 4;

		this.ctx.drawImage(this.hexImg, n * this.displayW, 0, this.displayW, this.displayH,
				this.display1X, this.displayY, this.displayW, this.displayH);
		this.ctx.drawImage(this.hexImg, i * this.displayW, 0, this.displayW, this.displayH,
				this.display2X, this.displayY, this.displayW, this.displayH);
	}
	
	if (this.ledDirty) {
		this.ledDirty = false;
	
		if (this.led) {
			this.ctx.drawImage(this.ledOnImg, 0, 0, this.ledW, this.ledH,
					this.ledX, this.ledY, this.ledW, this.ledH);
		} else {
			this.ctx.drawImage(this.offImg, this.ledX, this.ledY, this.ledW, this.ledH,
					this.ledX, this.ledY, this.ledW, this.ledH);
		}
	}
}

// install event handlers
CosmacElfObj.prototype.installEventHandlers = function() {
	var emu = this;
	$(document).keydown(function(event) {
		if (event.which == emu.inButtonKey) { // IN key down
			emu.inButtonDown();
		}
	})
	.keyup(function(event) {
		// change state of buttons and set to dirty
		if (event.which == emu.inButtonKey) { // IN button
			emu.switchState[11] = false;
			emu.switchDirty[11] = true;
		} else if (event.which in emu.keyMap) { // key defined in keyMap
			var idx = emu.keyMap[event.which];
			emu.switchState[idx] = !emu.switchState[idx];
			emu.switchDirty[idx] = true;
		}
		
		// load and run buttons may trigger CPU reset
		if (idx == 8 || idx == 10) {
			if (!emu.switchState[10] && !emu.switchState[8]) {
				emu.cpu.reset();
			}
		}
	});
	$('canvas#elfCanvas').mousedown(function(event) {
		var x = event.pageX - this.offsetLeft;
		var y = event.pageY - this.offsetTop;
		
		if (x > emu.switchX[11] && x < emu.switchX[11]+emu.switchW[11] // IN button
				&& y > emu.switchY[11] && y < emu.switchY[11]+emu.switchH[11]) {
			emu.inButtonDown();
		}
	})
	.mouseup(function(event) {
		var x = event.pageX - this.offsetLeft;
		var y = event.pageY - this.offsetTop;

		// find out which button/switch was clicked
		for (var i=0; i<emu.switchX.length; i++) {
			if (x > emu.switchX[i] && x < emu.switchX[i]+emu.switchW[i]
					&& y > emu.switchY[i] && y < emu.switchY[i]+emu.switchH[i]) {
				// toggle the button/switch
				if (i == 11) { // IN button
					emu.switchState[11] = false;
					emu.switchDirty[11] = true;
				} else { // key defined in keyMap
					emu.switchState[i] = !emu.switchState[i];
					emu.switchDirty[i] = true;
				}
				
				// load and run buttons may trigger CPU reset
				if (i == 8 || i == 10) {
					if (!emu.switchState[10] && !emu.switchState[8]) {
						emu.cpu.reset();
					}
				}
				break;
			}
		}
	});
}

// IN button was pushed down
CosmacElfObj.prototype.inButtonDown = function() {
	this.switchState[11] = true;
	this.switchDirty[11] = true;
	
	// in Load mode, IN causes a DMA-IN of the current input byte
	if (!this.switchState[8] && this.switchState[10]) { 
		var data = 0;
		for (var i = 0; i < 8; i++) {
			data |= (this.switchState[i] ? 1 : 0) << i;
		}
		this.cpu.dmaIn(data);
	}			
}

// draw outlines of each switch/button
// for debugging of drawing and mouse events
CosmacElfObj.prototype.drawButtonOutlines = function() {
	for (var i=0; i<this.switchX.length; i++) {
		this.ctx.beginPath();
		this.ctx.strokeStyle = '#f00';
		this.ctx.moveTo(this.switchX[i], this.switchY[i]);
		this.ctx.lineTo(this.switchX[i]+this.switchW[i], this.switchY[i]);
		this.ctx.lineTo(this.switchX[i]+this.switchW[i], this.switchY[i]+this.switchH[i]);
		this.ctx.lineTo(this.switchX[i], this.switchY[i]+this.switchH[i]);
		this.ctx.lineTo(this.switchX[i], this.switchY[i]);
		this.ctx.stroke();
	}
}
