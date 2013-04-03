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

// Represents a Cosmac Elf computer.

var CosmacElfObj = function(ctx, offImg, onImg, hexImg) {
	
	this.ctx = ctx;
	this.offImg = offImg;
	this.onImg = onImg;
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
	this.clockFreq = 1000000;
	
	// the hex value being displayed
	this.display = 0;
	
	// state of the led, based on the Q output from the CPU
	this.led = false;
	
	// state of the IN button (goes into EF4)
	this.in = false;
	
	// state of the Load switch (determines CPU running state)
	this.load = false;
	
	// state of the Run switch (determines CPU running state)
	this.run = false;
	
	// state of the Memory Protect switch
	this.mp = false;
	
	//
	// USER INTERFACE RELATED VARIABLES
	//
	
	// animation related
	this.fps = 60;
	this.interval = 1000 / this.fps;
	
	// number of machine cycles per frame
	// most CPU instructions require 2 machine cycles
	this.cyclesPerFrame = this.clockFreq / 8 / this.fps;

	// reset CPU
	this.cpu.reset();

	// location and dimension of switches, display, and LED
	this.switchX = [ 351, 307, 264, 222, 180, 138,  95,  52, 348, 307, 100,  65 ];
	this.switchY = [ 333, 333, 333, 333, 333, 333, 333, 333, 268, 268, 268, 305 ];
	this.switchW = [ 42, 44, 43, 42, 42, 42, 43, 43, 38, 41, 34, 26 ];
	this.switchH = [ 66, 66, 66, 66, 66, 66, 66, 66, 65, 65, 65, 24 ];
	this.switchState = [ false, false, false, false, false, false, false, false, false, false, false, false ];
	this.switchDirty = [ false, false, false, false, false, false, false, false, false, false, false, false ];

	this.display1X = 233;
	this.display2X = 205;
	this.displayY = 222;
	this.displayW = 17;
	this.displayH = 23;
	this.displayDirty = false;

	this.ledX = 222;
	this.ledY = 174;
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
	
	// install event handlers on the document
	this.installEventHandlers();
};

//
// EMULATOR PROTOTYPES
//

// Sets the output flip-flop Q from the CPU
CosmacElfObj.prototype.q = function(q) {
//alert("q:"+q+(this.ledDirty || (this.led != q)));
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
	if (!this.mp && address >= 0 && address < this.memory.length) {
		this.memory[address] = data;
	}
	this.display = this.read(address);
	this.displayDirty = true;
}

// The CPU uses this to input 8-bit unsigned data from the system bus
CosmacElfObj.prototype.in = function(nlines) { //Nlines = 1-7
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
CosmacElfObj.prototype.out = function(nlines, bus) { //Nlines = 1-7, bus=8-bit unsigned
	if (nlines == 4) {
		this.display = bus;
		this.displayDirty = displayDirty || display != bus;
	}
}

// The CPU uses this to get 1-bit External Flags EF1-EF4
CosmacElfObj.prototype.ef1 = function() { return false; };
CosmacElfObj.prototype.ef2 = function() { return false; };
CosmacElfObj.prototype.ef3 = function() { return false; };
CosmacElfObj.prototype.ef4 = function() { return this.in; };

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
	if (this.run && !this.load) {
		var cycles = this.cyclesPerFrame;
		while (cycles > 0) {
			cycles -= this.cpu.instruction();
		}
	}
}
	
//
// USER INTERFACE PROTOTYPES
//

// install event handlers
CosmacElfObj.prototype.installEventHandlers = function() {
	var emu = this;
	$(document).keydown(function(event) {
		if (event.which == emu.inButtonKey) { // IN key down
			emu.in = true;
			emu.switchState[11] = true;
			emu.switchDirty[11] = true;
			if (!emu.run && emu.load) {
				var data = 0;
				for (var i = 0; i < 8; i++) {
					data |= (emu.switchState[i] ? 1 : 0) << i;
				}
				emu.cpu.dmaIn(data);
			}			
		}
	})
	.keyup(function(event) {
		// change state of 11 toggle buttons and set to dirty
		if (event.which in emu.keyMap) { // key defined in keyMap
			var idx = emu.keyMap[event.which];
			emu.switchState[idx] = !emu.switchState[idx];
			emu.switchDirty[idx] = true;
		}
		
		// handle key specific behavior
		if (event.which == emu.inButtonKey) { // IN button
			emu.in = false;
			emu.switchState[11] = false;
			emu.switchDirty[11] = true;
		} else if (idx == 10) { // load button
			emu.load = !emu.load;
		} else if (idx == 9) {  // mp button
			emu.mp = !emu.mp;
		} else if (idx == 8) {  // run button
			emu.run = !emu.run;
		}
		
		// load and run buttons may trigger CPU reset
		if ((idx == 8 || idx == 10) && !emu.load && !emu.run) {
			if (!emu.load && !emu.run) {
				emu.cpu.reset();
			}
		}
	});
}

// updating of the user interface
CosmacElfObj.prototype.draw = function() {
	for (var i=0; i<this.switchDirty.length; i++) {
		if (this.switchDirty[i]) {
			this.switchDirty[i] = false;
			this.ctx.drawImage(this.switchState[i] ? this.onImg : this.offImg,
					this.switchX[i], this.switchY[i], this.switchW[i], this.switchH[i], 
					this.switchX[i], this.switchY[i], this.switchW[i], this.switchH[i]);
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
	
		this.ctx.drawImage(this.led ? this.onImg : this.offImg,
				this.ledX, this.ledY, this.ledW, this.ledH,
				this.ledX, this.ledY, this.ledW, this.ledH);
	}
}
