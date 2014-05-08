
var es = require('event-stream')
  , util = require('util')
  // , put = require('put')
  , binary = require('binary')
  , chainsaw = require('chainsaw')
  , EventEmitter = require('events').EventEmitter
  ;

var lib = require('./lib');
var Command = require('./lib/stick/commands');


/*
RESPONSES = { default: 64 };
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
  });
  var input = binary( );

  function open (cb) {
    var primer = es.readArray([
        new Command.commands.ProductInfo(console.log.bind(console, 'ProductInfo'))
      , new Command.commands.SignalStrength(console.log.bind(console, 'signal strength'))
    ]);
    es.pipeline(primer, flows( ), es.writeArray(cb));
  
  }
  
  var from_device = es.through(function (chunk) {this.emit('data', chunk);}
                      , function ( ) { });
  transport.pipe(from_device);

  function exec (item, next) {
    console.log('sending');

    if (item.close) {

      console.log(transport);
      transport
        .on('error', console.log.bind(console, 'OOPS'));
      master.on('error', console.log.bind(console, 'OOPS'));
      stream.on('error', console.log.bind(console, 'OOPS'));
      stream.end( );
      next( );
      return;
    }
    // item.emit('sending', transport);
    transport.write(item.format( ), function written ( ) {
      console.log('reading, (wrote)', item.format( ).toString('hex'), arguments);
      var input = item.response(binary( ), function read (err, data) {
        console.log('read', arguments);
        next(null, data);
      }).tap(function (vars) {
        item.emit('response', item, vars);
        input.end( );
        console.log('LISTENERS', from_device.listeners('end'));
        var last = {
            data:from_device.listeners('data').pop( )
          , end: from_device.listeners('end').pop( )
        };

        from_device.removeListener('data', last.data);
        from_device.removeListener('end', last.end);
      });

      from_device.pipe(input, {end: false});
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
    master.write(new Command.commands.RadioStats(fn));
  }

  function usb_stats (fn) {
    master.write(new Command.commands.UsbStats(fn));
  }

  function interface_stats (fn) {
    var list = [ new Command.commands.RadioStats( ), new Command.commands.UsbStats( ) ];
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

  }
  
  function chain (saw) {
    var flow = flows( );
    this.open = function open_chain (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var self = this;
      open(function (err, results) {
          cb.apply(self, arguments);
          saw.next( );
        /*
        self.poll_signal(function (err, signal) {
          console.log('haha');
        });
        */
      });
    }

    this.tap = function tap (cb) {
      saw.nest(cb);
    }

    this.stats = function stats (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var self = this;
      interface_stats(function (err, results) {
        cb.apply(self, arguments);
        saw.next( );
      });
    }

    this.signal_status = function signal_status (cb) {
      cb = (cb && cb.call) ? cb : empty;
      // var query = es.readArray([ ]);
      var self = this;
      function done (err, results) {
        cb.apply(self, arguments);
        saw.next( );
      }
      var query = new Command.commands.SignalStrength(done);
      // master.write(query);
      es.pipeline(es.readArray([query]), flow, es.writeArray(done));
    }

    this.poll_signal = function poll_signal (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var last = 0;
      var count = 0;
      var self = this;
      var _next = saw.next;
      function handle_signal (err, signal) {
        count++;
        console.log('signal attempt', count, signal);
        if (signal > 80) {
          cb.apply(self, arguments);
          saw.next( );
          _next( );
          return;
        }
        if (count < 10) self.signal_status(handle_signal);
        if (count > 10) saw.next( );
      }
      saw.nest(false, function ( ) {
        self.signal_status(handle_signal);
      });
    }

    this.send_packet = function send_packet (cb) {
    }

    this.status = function status (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var query = es.readArray([new Command.commands.Status( )]);
      var self = this;
      function done (err, results) {
        cb.apply(self, arguments);
        saw.next( );
      }
      es.pipeline(query, flow, es.writeArray(done));

    }

    this.close = function close (cb) {
      finish( );
      saw.next( );
    }
  }

  return chainsaw(chain);

  master.open = open;
  master.interface_stats = interface_stats;
  master.usb_stats = usb_stats;
  master.rf_stats = rf_stats;
  master.finish = finish;
  return master;
}
function empty ( ) { }

module.exports = uart;


if (!module.parent) {
  var Serial = require('serialport');
  var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  serial.open(function ( ) {
    console.log('stick', serial);
    var driver = uart(serial);
    driver.open(function (ctx) {
      // driver.usb_stats(console.log.bind(console, 'USB STATS'));
      console.log('opened', 'args', arguments, 'this', this);
      // driver.interface_stats(console.log.bind(console, 'INTERFACE STATS'));
      // driver.finish( );
    })
    .stats(console.log.bind(console, 'INTERFACE STATS'))
    .signal_status(console.log.bind(console, 'signal stength'))
    .poll_signal(console.log.bind(console, 'SIGNAL'))
    .status(console.log.bind(console, 'STATUS'))
    .stats(console.log.bind(console, 'INTERFACE STATS'))
    .close( )
    ;
  });
}

