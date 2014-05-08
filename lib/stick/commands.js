var util = require('util')
  , EventEmitter = require('events').EventEmitter
var lib = require('../../lib');

function Command (cb) {
  this.cb = cb;
  EventEmitter.call(this);
  return this;
}
util.inherits(Command, EventEmitter);

function assign_opcodes (command, opcodes) {
  command.prototype.opcodes = function list_opcodes ( ) {
    return opcodes;
  }
  return command;
}

Command.prototype.opcodes = function opcodes ( ) {
  return new Buffer(this.defaults.opcodes);
}
Command.prototype.format = function format ( ) {
  return new Buffer(this.opcodes( ));
}
Command.prototype.send = function send (transport) {
  transport.write(this.format( ));
  return this;
}

Command.prototype.decode = function (data) {
  // console.log(this, 'decoding', data);
  return this.defaults.decode(data);
  return data;
}

Command.prototype.response = function (input, next) {
  // var input = binary(transport);
  console.log('finding');
  var self = this;
  return input.buffer('raw', 64)
       .tap(function respond (vars) {
         console.log('TAPPED', vars);
         self.raw = vars
         self.parser = this;
         if (self.cb && self.cb.call) {
          self.cb(null, self.decode(vars.raw));
         }
         next(null, self.decode(vars.raw));
         // this.end( );
       }); // .flush( );
}
function registry (Base) {
  Base.commands = { };
  Base.create = function create (name, opts, alt_subclass) {
    var Subclass = alt_subclass ? alt_subclass : Base;
    Base.commands[name] = function (fn) {
      this.defaults = opts;
      Subclass.apply(this, arguments);
    }
    util.inherits(Base.commands[name], Subclass);
    return Base.commands[name];
  }
}
registry(Command);

Command.create('SignalStrength', { opcodes: [ 0x06, 0x00 ],
  decode: function decode_signal (data) {
    return data[3];
  }
});

Command.create('Stats', { opcodes: [ ],
  decode: decode_interface_stats
});

/*
function SignalStrength ( ) {
  Command.apply(this, arguments);
  return this;
}
util.inherits(SignalStrength, Command);
SignalStrength.prototype.opcodes = function ( ) {
  return [ 0x06, 0x00 ];
};
SignalStrength.prototype.decode = function (data) {
  return data[0];
};
function Stats ( ) {
  Command.apply(this, arguments);
  return this;
}
util.inherits(Stats, Command);
Stats.prototype.decode = decode_interface_stats;
*/

function decode_interface_stats (data) {
  var b = data.slice(0);
  data = new Buffer(data.slice(3));
  return {
    errors : {
      crc       : data[0],
      sequence  : data[1],
      naks      : data[2],
      timeouts  : data[3]
    },
    packets : {
      received  : lib.BangLong.apply(null, data.slice(4,8)),
      transmit  : lib.BangLong.apply(null, data.slice(8,12))
    }
  };
}

Command.create('UsbStats', { opcodes: [ 0x05, 0x01 ],
  decode: decode_interface_stats
});

Command.create('RadioStats', { opcodes: [ 0x05, 0x00 ],
  decode: decode_interface_stats
});

Command.create('Status', { opcodes: [ 0x03, 0x00 ],
  decode: decode_status
});

function decode_status (data) {
  var status = {
    ok: data[0] == 0
  , ack: data[0]
  , success: data[1]
  , status: data[2]
  , size: lib.BangInt.apply(null, data.slice(3,5)),
  };
  return status;
}

/*
function UsbStats ( ) {
  Stats.apply(this, arguments);
}
util.inherits(UsbStats, Stats);
UsbStats.prototype.opcodes = function ( ) {
  return [ 0x05, 0x01 ];
};

function RadioStats ( ) {
  Stats.apply(this, arguments);
}
util.inherits(RadioStats, Stats);
RadioStats.prototype.opcodes = function ( ) {
  return [ 0x05, 0x00 ];
};
*/

var ProductInfo = Command.create('ProductInfo', { opcodes: [ 0x04, 0x00 ],
  decode: decode_product_info
});

/*
function ProductInfo( ) {
  Command.apply(this, arguments);
}
util.inherits(ProductInfo, Command);
*/
ProductInfo.iface = function (i) {
  var keys = { 3: "USB", 1: "Paradigm RF" };
  if (keys[i]) {
    return keys[i];
  }
  return "UNKNOWN";
}
ProductInfo.rf_lookup = function (i) {
  var keys = { 255: "916.5Mhz", 1: "868.35Mhz", 0: "916.5Mhz" };
  if (keys[i]) {
    return keys[i];
  }
  return i.toString( ) + " UNKNOWN";
}
ProductInfo.decodeInterfaces = function (L) {
  // console.log('dc interfaces', L);
  var n = L[0], tail = L.slice(1);
  var i, k, v;
  var interfaces = [ ];
  for (var x = 0; x < n ; x++) {
    i = x*2;
    k = tail[i], v = tail[i+1];
    interfaces.push( [ k, ProductInfo.iface(v) ] );
  }
  return interfaces;
}
/*
ProductInfo.prototype.opcodes = function ( ) {
  return [ 0x04, 0x00 ];
};
ProductInfo.prototype.decode = decode_product_info;
*/

function decode_product_info (data) {
  var b = data.slice(0);
  data = new Buffer(data.slice(3));
  console.log('product info custom decoder');
  return {
    serial      : data.slice(0,3).toString('hex')
  , product     : [ data[3].toString( ), data[4].toString( ) ].join('.')
  // , product     : data.slice(3,5).toString( ).split('').join('.')
  , rf          : ProductInfo.rf_lookup(data[5])
  , description : data.slice(6, 16).toString( )
  , firmware    : [ data[16].toString( ), data[17].toString( ) ].join('.')
  , interfaces  : ProductInfo.decodeInterfaces(data.slice(18))
  };
}

module.exports = Command;

