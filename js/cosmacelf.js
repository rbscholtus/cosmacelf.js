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

var CosmacElfObj = function(ui) {
	
	// a UI listening to events
	this.ui = ui;
	
	// the CPU
	this.cpu = new Cdp1802Obj(this);
	
	// the memory
	this.memory = new Array();
	this.memory.length = 256;
	
	// clock frequency (should be between 1-2 MHz)
	// 8 clocks are required for 1 machine cycle
	this.clockFreq = 1760640;
	
	// emulation related
	this.fps = 60;
	this.interval = 1000 / this.fps;
	
	// number of machine cycles per frame
	// most CPU instructions require 2 machine cycles
	this.cyclesPerFrame = this.clockFreq / 8 / this.fps;
	
	// the hex value being displayed
	this.display = 0;
	
	// state of the led, based on the Q output from the CPU
	this.led = false;

	// state of the 12 inputs
	this.switchState = [ false, false, false, false, false, false, false, false, false, false, false, false ];

	// reset CPU
	this.cpu.reset();
};

// emulation loop
CosmacElfObj.prototype.emulate = function() {
	var emu = this;
	setTimeout(function() {
		window.requestAnimationFrame(function() { emu.emulate() });
		emu.update();
		emu.ui.draw();
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

// Sets the output flip-flop Q from the CPU
CosmacElfObj.prototype.setQ = function(q) {
	this.ui.ledDirty = this.ui.ledDirty || this.led != q;
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
	this.ui.displayDirty = true;
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
		this.ui.displayDirty = true;
	}
}

// The CPU uses this to get 1-bit External Flags EF1-EF4
CosmacElfObj.prototype.getEF1 = function() { return false; }
CosmacElfObj.prototype.getEF2 = function() { return false; }
CosmacElfObj.prototype.getEF3 = function() { return false; }
CosmacElfObj.prototype.getEF4 = function() { return this.switchState[11]; }

// IN button was pushed down
CosmacElfObj.prototype.inButtonDown = function() {
	this.switchState[11] = true;
	
	// in Load mode, IN causes a DMA-IN of the current input byte
	if (!this.switchState[8] && this.switchState[10]) { 
		var data = 0;
		for (var i = 0; i < 8; i++) {
			data |= (this.switchState[i] ? 1 : 0) << i;
		}
		this.cpu.dmaIn(data);
	}			
}

// IN button was released
CosmacElfObj.prototype.inButtonUp = function() {
	this.switchState[11] = false;
}

CosmacElfObj.prototype.toggleSwitchState = function(idx) {
	this.switchState[idx] = !this.switchState[idx];
	
	// load and run input may trigger CPU reset
	if (idx == 8 || idx == 10) {
		if (!this.switchState[10] && !this.switchState[8]) {
			this.cpu.reset();
		}
	}
}
