
var es = require('event-stream')
  , util = require('util')
  , put = require('put')
  , binary = require('binary')
  , buffers = require('buffers')
  , packet = require('packet')
  , EventEmitter = require('events').EventEmitter
  ;

var lib = require('./lib');

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

Command.prototype.format = function format ( ) {
  return new Buffer(this.opcodes( ));
}
Command.prototype.send = function send (transport) {
  transport.write(this.format( ));
  return this;
}

Command.prototype.decode = function (data) {
  console.log(this, 'decoding', data);
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
Stats.prototype.decode = function (data) {
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

function ProductInfo( ) {
  Command.apply(this, arguments);
}
util.inherits(ProductInfo, Command);
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
ProductInfo.prototype.opcodes = function ( ) {
  return [ 0x04, 0x00 ];
};
ProductInfo.prototype.decode = function (data) {
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
};
RESPONSES = { default: 64 };
/*
function Stick (transport) {
  if (this === (typeof window === 'undefined' ? global : window)) {
    return new Stick(transport);
  }
  this.transport = transport;
  this.incoming = binary(transport);
  // es.through(writer);
  var self = this;
  function writer (data) {
    // this.queue(data);
    self.parse(data);
  }
  // transport.pipe(this.incoming);
  EventEmitter.call(this);
  return this;
}
Stick.commands = { };
Stick.createMSG = function (name, opcodes, decoder) {
  return {decoder: decoder, name: name, opcodes: opcodes};
}
util.inherits(Stick, EventEmitter);
Stick.prototype.send = function (msg, cb) {
  this.emit('sending', msg);
  console.log('sending', msg);
  var self = this;
  this.once('response', function (ev) {
  });
  this.incoming.buffer('raw', 64)
      .tap(function (vars) {
        self.emit('response', vars.raw);
      });
  this.transport.write(this.format(msg));
}

Stick.prototype.signal_strength = function ( cb) {
  this.send(new Buffer([0x06, 0x00]), function decode (raw) {
    var info = raw[0];
    console.log("XXX sig strength", info);
  });
  return this;
}

Stick.prototype.product_info = function ( cb) {
  this.send(new Buffer([0x04, 0x00]), function decode (raw) {
    var info = ProductInfo.prototype.decode(raw);
    console.log("XXX PRODUCT INFO", info);
  });
  return this;
}
*/


function uart (transport) {
  var stream = es.through(function (d) {
    console.log('handling', d); this.queue(d);
  }, function ender ( ) {
    console.log("ENDING");
    this.emit('end');
    /*
    transport.close(function ( ) {
      console.log('CLOSED');
    });
    */
    /*
    */
  });
  var input = binary( );

  function open (cb) {
    var primer = es.readArray([
        new ProductInfo(console.log.bind(console, 'ProductInfo'))
      , new SignalStrength(console.log.bind(console, 'signal strength'))
      // , new RadioStats(console.log.bind(console, 'RadioStats'))
      // , new UsbStats(console.log.bind(console, 'UsbStats'))
    ]);
    // .pipe(stream, {end: false});
    es.pipeline(primer, flows( ), es.writeArray(cb));
  
  }

  function exec (item, next) {
    console.log('sending');
    // put( ).put()
    if (item.close) {
      // master.end( );
      console.log(transport);
      transport
        .on('error', console.log.bind(console, 'OOPS'));
      master.on('error', console.log.bind(console, 'OOPS'));
      stream.on('error', console.log.bind(console, 'OOPS'));
      stream.end( );
      next( );
      return;
    }
    item.emit('sending', transport);
    transport.write(item.format( ), function reading ( ) {
      console.log('reading, (wrote)', item.format( ).toString('hex'), arguments);
      var input = item.response(binary( ), function read (err, data) {
        console.log('read', arguments);
        next(null, data);
      }).tap(function (vars) {
        item.emit('response', item, vars);
      });
      // transport.pipe(input, {end: false});
      transport.pipe(input);
    });
  }
  function pause (item, next) {
    console.log('pausing');
    stream.pause( );
    next(null, item);
  }

  function resume (item, next) {
    console.log('resuming');
    next(null, item);
    stream.resume( );
  }


  function rf_stats (fn) {
    master.write(new RadioStats(fn));
  }

  function usb_stats (fn) {
    master.write(new UsbStats(fn));
  }

  function interface_stats (fn) {
    var list = [ new RadioStats( ), new UsbStats( ) ];
    function done (err, results) {
      console.log('XXX DONE results', arguments);
      fn(err, results);
    }

    es.pipeline(es.readArray(list), flows( ),
                es.writeArray(done));
  }

  var master = es.pipeline(stream, es.map(pause), es.map(exec), es.map(resume));
  master.on('end', function (err) {
    console.log('MASTER ENDED', arguments);
  });
  master.on('close', function (err) {
    console.log('CLOSED MASTER');
    transport.close(function (err) {
      console.log('CLOSED transport', arguments);
    });
  })
  master.on('end', console.log.bind(console, 'END on MASTER'));
  master.on('error', console.log.bind(console, 'ERROR on MASTER'));

  function flows ( ) {
    function iter (item, next) {
      if (item && item.on) {
        item.on('response', function respond (elem, vars) {
          console.log('response', elem, vars, elem.decode(vars.raw));
          next(null, elem.decode(vars.raw));
        });
        master.write(item);
        return;
      }
      master.write(item);
      next( );
    }
    return es.map(iter);
  }

  function finish ( ) {
    es.pipeline(es.readArray([{close:true}]), flows( ), es.writeArray(function (err, results) {
      console.log('FINISHED', arguments);
    }));
    // .pipe(flows( ));
    // transport.close( );
  }

  master.open = open;
  master.interface_stats = interface_stats;
  master.usb_stats = usb_stats;
  master.rf_stats = rf_stats;
  master.finish = finish;
  return master;
}


if (!module.parent) {
  var Serial = require('serialport');
  var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  serial.open(function ( ) {
    console.log('stick', serial);
    var driver = uart(serial);
    driver.open(function (ctx) {
      // driver.usb_stats(console.log.bind(console, 'USB STATS'));
      driver.interface_stats(console.log.bind(console, 'INTERFACE STATS'));
      driver.finish( );
    });
  });
}

