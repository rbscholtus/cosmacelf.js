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

// Definition of the Cdp1802 prototyped object

var Cdp1802Obj = function(context) {

    // the CPU's context (for I/O)
    this.context = context;
    
    // CPU is idle
    this.idle = false;
    
    // Interrupt enable
    this.IE = true;
    
    // Q is an output flip-flop
    this.Q = false;
    
    // 8-bit Data register (Accumulator)
    this.D = 0;
    
    // Data flag (ALU carry)
    this.DF = false;
    
    // 8-bit Auxilary holding register
    this.B = 0;
    
    // The 16 registers can be assigned by a programmer as program counters;
    // as data pointers; or as scratchpad locations (data registers) to hold
    // two bytes of data.
    this.R = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    // Selects one of the 16 registers as the program counter (PC)
    this.P = 0;
    
    // Selects one of the 16 registers to point to the memory for an operand
    // (or data) in certain ALU of I/O operations.
    this.X = 0;
    
    // Holds the low-order instruction digit. Can perform several functions
    // depending on the type of instruction fetched.
    this.N = 0;
    
    // Holds the high-order instruction digit
    this.I = 0;
    
    // Holds old X, P after interrupt (X is high nibble)
    this.T = 0;
};

// Resets the CPU
Cdp1802Obj.prototype.reset = function() {
    this.I = this.N = this.X = this.P = this.R[0] = 0;
    this.IE = true;
    this.idle = false;
    this.setQ(false);
    this.context.out(0, 0);
};

// Executes a given number of machine cycles
// Most CPU instructions take 2 machine cycles
Cdp1802Obj.prototype.execute = function(cycles) {

    // fetch, decode, execute
    var cyclesDone = 0;
    while (cyclesDone < cycles) {
        cyclesDone += this.instruction();
    }

    return cyclesDone;
};

// Executes a single instruction, returning the number of machine cycles used
Cdp1802Obj.prototype.instruction = function() {

    // idle returns immediately
    if (this.idle) {
        return 2;
    }

    // fetch
    var op = this.context.read(this.R[this.P]++);

    // decode
    this.I = op >> 4;
    this.N = op & 0x0f;
	
    // Decode & execute
    switch (this.I) {
        case 0x0: // idle or load D via reg N
            if (this.N == 0x0) {
                this.goIdle();
            } else {
                this.loadDViaN();
            }
            return 2;
        case 0x1: // increment reg N
            this.incrementR();
            return 2;
        case 0x2: // decrement reg N
            this.decrementR();
            return 2;
        case 0x3:
            switch (this.N) {
                case 0x0: // always branch
                    this.shortBranch(true);
                    return 2;
                case 0x1: // branch if Q is on
                    this.shortBranch(this.Q);
                    return 2;
                case 0x2: // branch on D zero
                    this.shortBranch(this.D == 0);
                    return 2;
                case 0x3: // branch if DF is on
                    this.shortBranch(this.DF);
                    return 2;
                case 0x4: // branch on external flag 1
                    this.shortBranch(this.context.getEF1());
                    return 2;
                case 0x5: // branch on external flag 2
                    this.shortBranch(this.context.getEF2());
                    return 2;
                case 0x6: // branch on external flag 3
                    this.shortBranch(this.context.getEF3());
                    return 2;
                case 0x7: // branch on external flag 4
                    this.shortBranch(this.context.getEF4());
                    return 2;
                case 0x8: // never branch
                    this.shortBranch(false);
                    return 2;
                case 0x9: // branch if Q is off
                    this.shortBranch(!this.Q);
                    return 2;
                case 0xa: // branch on D not zero
                    this.shortBranch(this.D != 0);
                    return 2;
                case 0xb: // branch if DF is off
                    this.shortBranch(!this.DF);
                    return 2;
                case 0xc: // branch on not external flag 1
                    this.shortBranch(!this.context.getEF1());
                    return 2;
                case 0xd: // branch on not external flag 2
                    this.shortBranch(!this.context.getEF2());
                    return 2;
                case 0xe: // branch on not external flag 3
                    this.shortBranch(!this.context.getEF3());
                    return 2;
                case 0xf: // branch on not external flag 4
                    this.shortBranch(!this.context.getEF4());
                    return 2;
            }
        case 0x4: // load D and advance
            this.loadDViaNAdvance();
            return 2;
        case 0x5: // store D into memory
            this.storeDViaN();
            return 2;
        case 0x6:
            switch (this.N) {
                case 0x0: // increment reg X
                    this.incrementRX();
                    return 2;
                case 0x1:
                case 0x2:
                case 0x3:
                case 0x4:
                case 0x5:
                case 0x6:
                case 0x7:
                    // output from memory to bus, nlines=N
                    this.out();
                    return 2;
                case 0x8: // 68 is an unused instruction (reserved for CDP1805)
                    return 2;
                case 0x9:
                case 0xa:
                case 0xb:
                case 0xc:
                case 0xd:
                case 0xe:
                case 0xf:
                    // input to memory and D, nlines=N
                    this.in();
                    return 2;
            }
            break;
        case 0x7:
            switch (this.N) {
                case 0x0: // return
                    this.ret(true);
                    return 2;
                case 0x1: // return and disable interrupts
                    this.ret(false);
                    return 2;
                case 0x2: // load D via R(X) and advance
                    this.loadDViaXAdvance();
                    return 2;
                case 0x3: // store D via R(X) and decrement
                    this.storeDViaXDec();
                    return 2;
                case 0x4: // add with carry
                    this.addCarry();
                    return 2;
                case 0x5: // subtract D from memory with borrow
                    this.subDBorrow();
                    return 2;
                case 0x6: // shift D right with carry
                    this.shiftDRightCarry();
                    return 2;
                case 0x7: // subtract memory from D with borrow
                    this.subMemoryBorrow();
                    return 2;
                case 0x8: // save T
                    this.saveT();
                    return 2;
                case 0x9: // save X and P in T
                    this.mark();
                    return 2;
                case 0xa: // reset Q
                    this.setQ(false);
                    return 2;
                case 0xb: // set Q
                    this.setQ(true);
                    return 2;
                case 0xc: // add with carry immediate
                    this.addCarryImmediate();
                    return 2;
                case 0xd: // subtract D with borrow, immediate
                    this.subDBorrowImmediate();
                    return 2;
                case 0xe: // shift D left with carry
                    this.shiftDLeftCarry();
                    return 2;
                case 0xf: // subtract memory with borrow, immediate
                    this.subMemoryBorrowImmediate();
                    return 2;
            }
        case 0x8: // get low byte of reg N
            this.getLowR();
            return 2;
        case 0x9: // get high byte of reg N
            this.getHighR();
            return 2;
        case 0xa: // put this.D in low byte of reg N
            this.putLowR();
            return 2;
        case 0xb: // put this.D in high byte of reg N
            this.putHighR();
            return 2;
        case 0xc:
            switch (this.N) {
                case 0x0: // always long branch
                    this.longBranch(true);
                    return 3;
                case 0x1: // long branch if Q is on
                    this.longBranch(this.Q);
                    return 3;
                case 0x2: // long branch on D zero
                    this.longBranch(this.D == 0);
                    return 3;
                case 0x3: // long branch if DF is on
                    this.longBranch(this.DF);
                    return 3;
                case 0x4: // no operation
                   //this.longSkip(false);
                    return 3;
                case 0x5: // long skip if Q is off
                    this.longSkip(!this.Q);
                    return 3;
                case 0x6: // long skip if D not zero
                    this.longSkip(this.D != 0);
                    return 3;
                case 0x7: // long skip if DF is off
                    this.longSkip(!this.DF);
                    return 3;
                case 0x8: // long skip
                    this.longBranch(false);
                    return 3;
                case 0x9: // long branch if Q is off
                    this.longBranch(!this.Q);
                    return 3;
                case 0xa: // long branch on not zero
                    this.longBranch(this.D != 0);
                    return 3;
                case 0xb: // long branch if DF is off
                    this.longBranch(!this.DF);
                    return 3;
                case 0xc: // long skip if interrupts enabled
                    this.longSkip(this.IE);
                    return 3;
                case 0xd: // long skip if Q is on
                    this.longSkip(this.Q);
                    return 3;
                case 0xe: // long skip if D zero
                    this.longSkip(this.D == 0);
                    return 3;
                case 0xf: // long skip if DF is on
                    this.longSkip(this.DF);
                    return 3;
            }
        case 0xd: // set P
            this.setP();
            return 2;
        case 0xe: // set X
            this.setX();
            return 2;
        case 0xf:
            switch (this.N) {
                case 0x0: // load D via R(X)
                    this.loadDViaX();
                    return 2;
                case 0x1: // logical OR
                    this.ORViaX();
                    return 2;
                case 0x2: // logical AND
                    this.ANDViaX();
                    return 2;
                case 0x3: // logical XOR
                    this.XORViaX();
                    return 2;
                case 0x4: // add
                    this.add();
                    return 2;
                case 0x5: // subtract D from memory
                    this.subD();
                    return 2;
                case 0x6: // shift D right
                    this.shiftDRight();
                    return 2;
                case 0x7: // subtract memory from D
                    this.subMemory();
                    return 2;
                case 0x8: // load D immediate
                    this.loadDImmediate();
                    return 2;
                case 0x9: // OR immediate
                    this.ORImmediate();
                    return 2;
                case 0xa: // AND immediate
                    this.ANDImmediate();
                    return 2;
                case 0xb: // XOR immediate
                    this.XORImmediate();
                    return 2;
                case 0xc: // add immediate
                    this.addImmediate();
                    return 2;
                case 0xd: // subtract D from memory immediate
                    this.subDImmediate();
                    return 2;
                case 0xe: // shift D left
                    this.shiftDLeft();
                    return 2;
                case 0xf: // subtract memory from D immediate
                    this.subMemoryImmediate();
                    return 2;
            }
    }

    // this should never happen
    return 0;
}

/* DMA AND INTERRUPT OPERATIONS */

Cdp1802Obj.prototype.dmaIn = function(data) {
    this.context.write(this.R[0]++, data);
}

Cdp1802Obj.prototype.dmaOut = function() {
    return this.context.read(this.R[0]++);
}

Cdp1802Obj.prototype.interrupt = function() {
    this.IE = false;
    this.T = (this.X << 4) | this.P;
    this.P = 1;
    this.X = 2;

    return 1;
}

/* INPUT - OUTPUT BYTE TRANSFER */

Cdp1802Obj.prototype.out = function() {
    this.context.out(this.N, this.context.read(this.R[this.X]++));
}

Cdp1802Obj.prototype.in = function() {
    this.D = this.context.in(this.N & 0x7);
    this.context.write(this.R[this.X], this.D);
}

/* MEMORY REFERENCE INSTRUCTIONS */

// LDN 0N Load via N
Cdp1802Obj.prototype.loadDViaN = function() {
    this.D = this.context.read(this.R[this.N]);
}

// LDA 4N Load Advance
Cdp1802Obj.prototype.loadDViaNAdvance = function() {
    this.D = this.context.read(this.R[this.N]++);
}

// LDX F0 Load via X
Cdp1802Obj.prototype.loadDViaX = function() {
    this.D = this.context.read(this.R[this.X]);
}

// LDXA 72 Load via X and Advance
Cdp1802Obj.prototype.loadDViaXAdvance = function() {
    this.D = this.context.read(this.R[this.X]++);
}

// LDI F8 Load Immediate
Cdp1802Obj.prototype.loadDImmediate = function() {
    this.D = this.context.read(this.R[this.P]++);
}

// STR 5N Store via N
Cdp1802Obj.prototype.storeDViaN = function() {
    this.context.write(this.R[this.N], this.D);
}

// STXD 73 Store via X and this.Decrement
Cdp1802Obj.prototype.storeDViaXDec = function() {
    this.context.write(this.R[this.X]--, this.D);
}

/* REGISTER OPERATIONS */

// INC 1N Increment reg N
Cdp1802Obj.prototype.incrementR = function() {
    this.R[this.N]++;
    this.R[this.N] &= 0xffff;
	//this.R[this.N] = (this.R[this.N] + 1) & 0xffff;
}

// DEC 2N Decrement reg N
Cdp1802Obj.prototype.decrementR = function() {
    this.R[this.N]--;
    this.R[this.N] &= 0xffff;
	//this.R[this.N] = (this.R[this.N] - 1) & 0xffff;
}

// IRX 60 Increment reg X
Cdp1802Obj.prototype.incrementRX = function() {
    this.R[this.X]++;
    this.R[this.X] &= 0xffff;
	//this.R[this.X] = (this.R[this.X] + 1) & 0xffff;
}

// GLO 8N Get low reg N
Cdp1802Obj.prototype.getLowR = function() {
    this.D = this.R[this.N] & 0xff;
}

// PLO AN Put low reg N
Cdp1802Obj.prototype.putLowR = function() {
    this.R[this.N] = (this.R[this.N] & 0xff00) | this.D;
}

// GHI 9N Get high reg N
Cdp1802Obj.prototype.getHighR = function() {
    this.D = this.R[this.N] >> 8;
}

// PHI BN Put high reg N
Cdp1802Obj.prototype.putHighR = function() {
    this.R[this.N] = (this.D << 8) | (this.R[this.N] & 0xff);
}

/* LOGIC OPERATIONS */

// OR F1 OR
Cdp1802Obj.prototype.ORViaX = function() {
    this.D |= this.context.read(this.R[this.X]);
}

// ORI F9 OR Immediate
Cdp1802Obj.prototype.ORImmediate = function() {
    this.D |= this.context.read(this.R[this.P]++);
}

// AND F2 AND
Cdp1802Obj.prototype.ANDViaX = function() {
    this.D &= this.context.read(this.R[this.X]);
}

// ANI FA AND Immediate
Cdp1802Obj.prototype.ANDImmediate = function() {
    this.D &= this.context.read(this.R[this.P]++);
}

// XOR F3 XOR
Cdp1802Obj.prototype.XORViaX = function() {
    this.D ^= this.context.read(this.R[this.X]);
}

// XRI FB XOR Immediate
Cdp1802Obj.prototype.XORImmediate = function() {
    this.D ^= this.context.read(this.R[this.P]++);
}

// SHR F6 Shift Right
Cdp1802Obj.prototype.shiftDRight = function() {
    this.DF = (this.D & 0x1) > 0;
    this.D >>= 1;
}

// SHRC 76 Shift Right with Carry
// RSHR 76 Ring Shift Right
Cdp1802Obj.prototype.shiftDRightCarry = function() {
    if (this.DF) {
        this.DF = (this.D & 0x1) > 0;
        this.D >>= 1;
        this.D |= 0x80;
    } else {
        this.DF = (this.D & 0x1) > 0;
        this.D >>= 1;
    }
}

// SHL FE Shift Left
Cdp1802Obj.prototype.shiftDLeft = function() {
    this.DF = (this.D & 0x80) > 0;
    this.D <<= 1;
}

// SHLC 7E Shift Left with Carry
// RSHL 7E Ring Shift Left
Cdp1802Obj.prototype.shiftDLeftCarry = function() {
    if (this.DF) {
        this.DF = (this.D & 0x80) > 0;
        this.D <<= 1;
        this.D |= 1;
    } else {
        this.DF = (this.D & 0x80) > 0;
        this.D <<= 1;
    }
}

/* ARITHMETIC OPERATIONS */

// ADD F4 - Add
Cdp1802Obj.prototype.add = function() {
    var temp = this.context.read(this.R[this.X]) + this.D;
    this.D = temp & 0xff;
    this.DF = (temp & 0x100) > 0;
}

// ADI FC - Add immediate
Cdp1802Obj.prototype.addImmediate = function() {
    var temp = this.context.read(this.R[this.P]++) + this.D;
    this.D = temp & 0xff;
    this.DF = (temp & 0x100) > 0;
}

// ADC 74 - Add with carry
Cdp1802Obj.prototype.addCarry = function() {
    var temp = this.context.read(this.R[this.X]) + this.D + (DF ? 1 : 0);
    this.D = temp & 0xff;
    this.DF = (temp & 0x100) > 0;
}

// ADCI 7C - Add with carry, immediate
Cdp1802Obj.prototype.addCarryImmediate = function() {
    var temp = this.context.read(this.R[this.P]++) + this.D + (DF ? 1 : 0);
    this.D = temp & 0xff;
    this.DF = (temp & 0x100) > 0;
}

// SD F5 - Subtract this.D
Cdp1802Obj.prototype.subD = function() {
    var temp = this.context.read(this.R[this.X]) - this.D;
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SDI FD - Subtract this.D immediate
Cdp1802Obj.prototype.subDImmediate = function() {
    var temp = this.context.read(this.R[this.P]++) - this.D;
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SDB 75 - Subtract this.D with borrow
Cdp1802Obj.prototype.subDBorrow = function() {
    var temp = this.context.read(this.R[this.X]) - this.D - (this.DF ? 0 : 1);
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SDBI 7D - Subtract this.D with borrow, immediate
Cdp1802Obj.prototype.subDBorrowImmediate = function() {
    var temp = this.context.read(this.R[this.P]++) - this.D - (this.DF ? 0 : 1);
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SM F7 - Subtract memory
Cdp1802Obj.prototype.subMemory = function() {
    var temp = this.D - this.context.read(this.R[this.X]);
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SMI FF - Subtract memory immediate
Cdp1802Obj.prototype.subMemoryImmediate = function() {
    var temp = this.D - this.context.read(this.R[this.P]++);
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SMB 77 - Subtract memory with borrow
Cdp1802Obj.prototype.subMemoryBorrow = function() {
    var temp = this.D - this.context.read(this.R[this.X]) - (this.DF ? 0 : 1);
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

// SMBI 7F - Subtract memory with borrow, immediate
Cdp1802Obj.prototype.subMemoryBorrowImmediate = function() {
    var temp = this.D - this.context.read(this.R[this.P]++) - (this.DF ? 0 : 1);
    this.D = temp & 0xff;
    this.DF = temp >= 0;
}

/* BRANCH INSTRUCTIONS - SHORT BRANCH */

// BR 30 - Short branch
Cdp1802Obj.prototype.shortBranch = function(b) {
    if (b) {
        this.R[this.P] = (this.R[this.P] & 0xff00) | this.context.read(this.R[this.P]);
    } else {
        this.R[this.P]++;
    }
}

/* BRANCH INSTRUCTIONS - LONG BRANCH */

// LBR C0 - Long branch
Cdp1802Obj.prototype.longBranch = function(b) {
    if (b) {
        this.R[this.P] = (this.context.read(this.R[this.P]) << 8) | this.context.read(this.R[this.P] + 1);
    } else {
        this.R[this.P] += 2;
    }
}

/* SKIP INSTRUCTIONS */

// LSKP C8 - Long skip
Cdp1802Obj.prototype.longSkip = function(b) {
    if (b) {
        this.R[this.P] += 2;
    }
}

/* CONTROL INSTRUCTIONS */

// IDL 00 - Idle
Cdp1802Obj.prototype.goIdle = function() {
    this.idle = true;
    this.context.out(0, this.context.read(this.R[0]));
}

// SEP DN - Set P
Cdp1802Obj.prototype.setP = function() {
    this.P = this.N;
}

// SEX EN - Set X
Cdp1802Obj.prototype.setX = function() {
    this.X = this.N;
}

// SEQ 7B - Set Q
// REQ 7A - Reset Q (b=false)
Cdp1802Obj.prototype.setQ = function(b) {
    this.Q = b;
    this.context.q(b);
}

// SAV 78 - Save
Cdp1802Obj.prototype.saveT = function() {
    this.context.write(this.R[this.X], this.T);
}

// MARK 79 - Push X, P to stack
Cdp1802Obj.prototype.mark = function() {
    this.T = (this.X << 4) | this.P;
    this.context.write(this.R[2], this.T);
    this.X = this.P;
    this.R[2]--;
}

// RET 70 - Return
// DIS 71 - Disable (b=false)
Cdp1802Obj.prototype.ret = function(b) {
    var temp = this.context.read(this.R[this.X]++);
    this.P = temp & 0xf;
    this.X = temp >> 4;
    this.IE = b;
}
