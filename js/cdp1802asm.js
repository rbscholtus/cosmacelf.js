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
// 
//

var Cdp1802AsmObj = function() {

	// 1802 Mnemonics mapping to binary codes
	this.opTable = {
		'IDL': { 'opcode':0x00, 'type':'' },
		'LDN': { 'opcode':0x00, 'type':'reg' },
		'INC': { 'opcode':0x10, 'type':'reg' },
		'DEC': { 'opcode':0x20, 'type':'reg' },
		'BR':  { 'opcode':0x30, 'type':'oprnd1' },
		'BQ':  { 'opcode':0x31, 'type':'oprnd1' },
		'BZ':  { 'opcode':0x32, 'type':'oprnd1' },
		'BDF': { 'opcode':0x33, 'type':'oprnd1' },
		'BPZ': { 'opcode':0x33, 'type':'oprnd1' },
		'BGE': { 'opcode':0x33, 'type':'oprnd1' },
		'B1':  { 'opcode':0x34, 'type':'oprnd1' },
		'B2':  { 'opcode':0x35, 'type':'oprnd1' },
		'B3':  { 'opcode':0x36, 'type':'oprnd1' },
		'B4':  { 'opcode':0x37, 'type':'oprnd1' },
		'NBR': { 'opcode':0x38, 'type':'' },
		'SKP': { 'opcode':0x38, 'type':'' },
		'BNQ': { 'opcode':0x39, 'type':'oprnd1' },
		'BNZ': { 'opcode':0x3A, 'type':'oprnd1' },
		'BNF': { 'opcode':0x3B, 'type':'oprnd1' },
		'BM':  { 'opcode':0x3B, 'type':'oprnd1' },
		'BL':  { 'opcode':0x3B, 'type':'oprnd1' },
		'BN1': { 'opcode':0x3C, 'type':'oprnd1' },
		'BN2': { 'opcode':0x3D, 'type':'oprnd1' },
		'BN3': { 'opcode':0x3E, 'type':'oprnd1' },
		'BN4': { 'opcode':0x3F, 'type':'oprnd1' },
		'LDA': { 'opcode':0x40, 'type':'reg' },
		'STR': { 'opcode':0x50, 'type':'reg' },
		'IRX': { 'opcode':0x60, 'type':'' },
		'OUT': { 'opcode':0x60, 'type':'dev' },
		'IN':  { 'opcode':0x60, 'type':'dev' },
		'RET':  { 'opcode':0x70, 'type':'' },
		'DIS':  { 'opcode':0x71, 'type':'' },
		'LDXA': { 'opcode':0x72, 'type':'' },
		'STXD': { 'opcode':0x73, 'type':'' },
		'ADC':  { 'opcode':0x74, 'type':'' },
		'SDB':  { 'opcode':0x75, 'type':'' },
		'SHRC': { 'opcode':0x76, 'type':'' },
		'RSHR': { 'opcode':0x76, 'type':'' },
		'SMB':  { 'opcode':0x77, 'type':'' },
		'SAV':  { 'opcode':0x78, 'type':'' },
		'MARK': { 'opcode':0x79, 'type':'' },
		'REQ':  { 'opcode':0x7A, 'type':'' },
		'SEQ':  { 'opcode':0x7B, 'type':'' },
		'ADCI': { 'opcode':0x7C, 'type':'imme' },
		'SDBI': { 'opcode':0x7D, 'type':'imme' },
		'SHLC': { 'opcode':0x7E, 'type':'' },
		'RSHL': { 'opcode':0x7E, 'type':'' },
		'SMBI': { 'opcode':0x7F, 'type':'imme' },
		'GLO': { 'opcode':0x80, 'type':'reg' },
		'GHI': { 'opcode':0x90, 'type':'reg' },
		'PLO': { 'opcode':0xA0, 'type':'reg' },
		'PHI': { 'opcode':0xB0, 'type':'reg' },
		'LBR':  { 'opcode':0xC0, 'type':'oprnd2' },
		'LBQ':  { 'opcode':0xC1, 'type':'oprnd2' },
		'LBZ':  { 'opcode':0xC2, 'type':'oprnd2' },
		'LBDF': { 'opcode':0xC3, 'type':'oprnd2' },
		'NOP':  { 'opcode':0xC4, 'type':'' },
		'LSNQ': { 'opcode':0xC5, 'type':'' },
		'LSNZ': { 'opcode':0xC6, 'type':'' },
		'LSNF': { 'opcode':0xC7, 'type':'' },
		'NLBR': { 'opcode':0xC8, 'type':'' },
		'LSKP': { 'opcode':0xC8, 'type':'' },
		'LBNQ': { 'opcode':0xC9, 'type':'oprnd2' },
		'LBNZ': { 'opcode':0xCA, 'type':'oprnd2' },
		'LBNF': { 'opcode':0xCB, 'type':'oprnd2' },
		'LSIE': { 'opcode':0xCC, 'type':'' },
		'LSQ':  { 'opcode':0xCD, 'type':'' },
		'LSZ':  { 'opcode':0xCE, 'type':'' },
		'LSDF': { 'opcode':0xCF, 'type':'' },
		'SEP': { 'opcode':0xD0, 'type':'reg' },
		'SEX': { 'opcode':0xE0, 'type':'reg' },
		'LDX': { 'opcode':0xF0, 'type':'' },
		'OR':  { 'opcode':0xF1, 'type':'' },
		'AND': { 'opcode':0xF2, 'type':'' },
		'XOR': { 'opcode':0xF3, 'type':'' },
		'ADD': { 'opcode':0xF4, 'type':'' },
		'SD':  { 'opcode':0xF5, 'type':'' },
		'SHR': { 'opcode':0xF6, 'type':'' },
		'SM':  { 'opcode':0xF7, 'type':'' },
		'LDI': { 'opcode':0xF8, 'type':'imme' },
		'ORI': { 'opcode':0xF9, 'type':'imme' },
		'ANI': { 'opcode':0xFA, 'type':'imme' },
		'XRI': { 'opcode':0xFB, 'type':'imme' },
		'ADI': { 'opcode':0xFC, 'type':'imme' },
		'SDI': { 'opcode':0xFD, 'type':'imme' },
		'SHL': { 'opcode':0xFE, 'type':'' },
		'SMI': { 'opcode':0xFF, 'type':'imme' }
	};

	// the regular expression used for matching assembly lines
	// 1: label
	// 2: mnemonic
	// 3: decimal oprd
	// 4: hex oprd
	// 5: 'r'
	// 6: register number
	// 7: label
	this.opRegEx = /^([a-z][a-z0-9_.]{0,5})?\s+([a-z]{2,4})(?:\s+(?:([0-9]{1,5})|([0-9][0-9a-f]{0,4})h|(r?)([0-9a-f])|([a-z][a-z0-9_.]{0,5})))?(?:\s*:.*)?$/i
}

Cdp1802AsmObj.prototype.assemble = function(str) {
	var lines = str.split('\n');

	var pc = 0x00;
	var binStr = '';
	var labels = {};
	var binary = [];
	
	for (i=0; i<lines.length; i++) {
		// match a complete instruction line
		if ($.trim(lines[i]) == '') {
			continue;
		}
		var match = this.opRegEx.exec(lines[i]);

		if (match == null) {
			throw "Error on line "+(i+1)+": Invalid syntax";
		}
		
		// check if there is a label
		if (match[1] != undefined) {
			if (match[1] in labels) {
				throw "Error on line "+(i+1)+": Label '"+match[1]+"' already defined";
			}
			labels[match[1]] = pc;
		}
		
		// find the mnemonic
		var op = this.opTable[match[2]];
		if (op == undefined) {
			throw "Error on line "+(i+1)+": Invalid mnemonic: "+match[2];
		}
		
		// regular operation found
		if (op['type'] == '') {
			binary[pc++] = op['opcode'];

		// register operation found
		} else if (op['type'] == 'reg') {
			if (match[6] == undefined) {
				throw "Error on line "+(i+1)+": Register number [0-9a-f] expected";
			}
			binary[pc++] = op['opcode'] | match[6];
		
		// instruction with immediate or 1-byte operand found
		} else if (op['type'] == 'imme' || op['type'] == 'oprnd1') {
			// output opcode
			binary[pc++] = op['opcode'];
			
			// output operand
			if (match[4] != undefined) {		// matched hex operand
				var oprd = parseInt(match[4], 16);
			} else if (match[3] != undefined) {	// matched dec operand
				var oprd = parseInt(match[3], 10);
			} else if (match[7] != undefined) {	// matched label
				if (labels[match[7]] == undefined) {
					throw "Error on line "+(i+1)+": Label '"+match[7]+"' is undefined";
				}
				var oprd = labels[match[7]];
			} else {
				throw "Error on line "+(i+1)+": Operand or label expected";
			}
			binary[pc++] = oprd;
		
		// instruction with 2-byte operand found
		} else if (op['type'] == 'oprnd2') {
			// output opcode
			binary[pc++] = this.toHexStr(op['opcode']);
			
			// output operand
			if (match[4] != undefined) {		// matched hex operand
				var oprd = parseInt(match[4], 16);
			} else if (match[3] != undefined) {	// matched dec operand
				var oprd = parseInt(match[3], 10);
			} else if (match[7] != undefined) {	// matched label
				if (labels[match[7]] == undefined) {
					throw "Error on line "+(i+1)+": Label '"+match[7]+"' is undefined";
				}
				var oprd = labels[match[7]];
			} else {
				throw "Error on line "+(i+1)+": Operand or label expected";
			}
			binary[pc++] = (oprd >> 8) & 0xff;
			binary[pc++] = oprd & 0xff;
		}
	}
	
	return binary;
}

Cdp1802AsmObj.prototype.to2DigitHexStr = function(dec) {
	var h = dec.toString(16).toUpperCase();
	return h.length<2 ? '0'+h : h;
}
