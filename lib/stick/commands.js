var util = require('util')
  , put = require('put')
  , EventEmitter = require('events').EventEmitter
var lib = require('../../lib');
var log = require('../log')('stick.commands');


/*
 * Stick commands are short opcodes and responses used to talk to the usb stick
 * itself.
 * Base Command
 */

function Command (cb) {
  this.cb = cb;
  EventEmitter.call(this);
  // the defaults actually control everything
  this.defaults = this.defaults ? this.defaults : { };
  return this;
}
util.inherits(Command, EventEmitter);

// Fetch opcodes for this command.
Command.prototype.opcodes = function opcodes ( ) {
  if (this.defaults.opcodes && this.defaults.opcodes.call) {
    return this.defaults.opcodes.apply(this, arguments);
  }
  return new Buffer(this.defaults.opcodes);
}

// Format all the bytes for this command.
Command.prototype.format = function format ( ) {
  if (this.defaults.format && this.defaults.format.call) {
    return this.defaults.format.apply(this, arguments);
  }
  return new Buffer(this.opcodes( ));
}

/*
// XXX: unused, delete?
Command.prototype.send = function send (transport) {
  transport.write(this.format( ));
  return this;
}
*/

// Decode the raw bytes into some meaningful data structure.
Command.prototype.decode = function (data) {
  // log.info(this, 'decoding', data);
  return this.defaults.decode(data);
  return data;
}

// Perform a read on the input stream, decode results.
Command.prototype.response = function (input, next) {
  // var input = binary(transport);
  log.info('finding');
  if (this.defaults.response && this.defaults.response.call) {
    return this.defaults.response.apply(this, arguments);
  }
  var self = this;
  return input.buffer('raw', 64)
       .tap(function respond (vars) {
         log.info('TAPPED', vars);
         self.raw = vars
         self.parser = this;
         if (self.cb && self.cb.call) {
          self.cb(null, self.decode(vars.raw));
         }
         next(null, self.decode(vars.raw));
         // this.end( );
       }); // .flush( );
}

// Create a registry of all stick commands.
function registry (Base) {
  Base.commands = { };
  Base.create = function create (name, opts, alt_subclass) {
    var Subclass = alt_subclass ? alt_subclass : Base;
    Base.commands[name] = function (fn) {
      this.defaults = opts;
      if (this.defaults.init && this.defaults.init.call) {
        this.defaults.init.apply(this, arguments);
      } else {
        Subclass.apply(this, arguments);
      }
    };
    util.inherits(Base.commands[name], Subclass);
    return Base.commands[name];
  }
}
registry(Command);

// SignalStrength: not sure something to do with warming up the stick's radio
// needs to be polled until result is greater than ~80 or so (usually only a
// handful of attempts)
Command.create('SignalStrength', { opcodes: [ 0x06, 0x00 ],
  decode: function decode_signal (data) {
    return data[3];
  }
});

// decodes interface stats
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

// UsbStats: queries stats errors on usb interface
Command.create('UsbStats', { opcodes: [ 0x05, 0x01 ],
  decode: decode_interface_stats
});

// RadioStats: queries stats and errors on radio interface
Command.create('RadioStats', { opcodes: [ 0x05, 0x00 ],
  decode: decode_interface_stats
});

// Status: check radio buffer size and status
Command.create('Status', { opcodes: [ 0x03, 0x00 ],
  decode: decode_status
});

function decode_status (data) {
  var status = {
    ok: data[0] == 0
  , ack: data[0]
  , success: data[1]
  , status: data[2]
  , size: lib.BangInt.apply(null, data.slice(6,8)),
  };
  return status;
}

// TransmitPacket: send packet on radio
Command.create('TransmitPacket', {
  opcodes: [1, 0, 167, 1],
  init: function (command, cb) {
    Command.call(this, cb);
    this.command = command;
    return this;
  },
  format: function ( ) {
    var head = this.opcodes( );
    var request = this.command.request( );
    var parameter_description = describe_params(request.params);
    var params = new Buffer(request.params);
    var packet = put( )
      .put(head)
      .put(request.serial)
      .put(parameter_description)
      .put(new Buffer([request.magic]))
      .put(new Buffer([request.retries]))
      .put(new Buffer([request.pageMode]))
      .put(new Buffer([0x00]))
      .put(new Buffer([request.op]))
      ;
    packet.word8(lib.CRC8(packet.buffer( )))
      .put(params)
      .word8(lib.CRC8(request.params))
    ;
    return packet.buffer( );
  },
  decode: function (data) {
    return new Buffer(data);
  }
});

function describe_params (params) {
  var count = params.length;
  var result = new Buffer([ 0x80 | lib.HighByte(count), lib.LowByte(count) ]);
  return result;
}

// ReadPacket: transfer size bytes from radio buffer
Command.create('ReadPacket', {
  opcodes: [ 0x0C, 0x00 ],
  init: function (size, cb) {
    Command.call(this, cb);
    this.size = size;
  },
  response: function (input, next) {
    var self = this;
    return input.buffer('raw', this.size)
         .tap(function respond (vars) {
           log.info('ReadPacket', vars);
           self.raw = vars
           self.parser = this;
           if (self.cb && self.cb.call) {
            self.cb(null, self.decode(vars.raw));
           }
           next(null, self.decode(vars.raw));
         })
         ;
  },
  format: function ( ) {
    var head = this.opcodes( );
    var packet = put( )
      .put(head)
      .put(new Buffer([ lib.HighByte(this.size), lib.LowByte(this.size) ]))
      ;
    return packet.buffer( );
  },
  decode: function (data) {
    return new Buffer(new Buffer(data).slice(13));
  }
});


// ProductInfo - identify the usb stick
var ProductInfo = Command.create('ProductInfo', { opcodes: [ 0x04, 0x00 ],
  decode: decode_product_info
});

// decoding routines for ProductInfo
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
  // log.info('dc interfaces', L);
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

function decode_product_info (data) {
  var b = data.slice(0);
  data = new Buffer(data.slice(3));
  log.info('product info custom decoder');
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

