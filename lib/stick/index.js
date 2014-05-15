var es = require('event-stream')
  // , put = require('put')
  , binary = require('binary')
  , chainsaw = require('chainsaw')
  , EventEmitter = require('events').EventEmitter
  ;
var lib = require('../../lib');
var Command = require('./commands');


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
        input.end( );
        item.emit('response', item, vars);
        // console.log('LISTENERS', from_device._events);
        var last = {
            data:from_device.listeners('data').pop( )
          , end: from_device.listeners('end').pop( )
          , close: from_device.listeners('close').pop( )
          , error: from_device.listeners('error').pop( )
        };

        from_device.removeListener('data', last.data);
        from_device.removeListener('end', last.end);
        from_device.removeListener('close', last.close);
        from_device.removeListener('error', last.error);
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

  function interface_stats (fn, flow) {
    flow = flow ? flow : flows( );
    var list = [ new Command.commands.RadioStats( ), new Command.commands.UsbStats( ) ];
    function done (err, results) {
      console.log('XXX DONE results', arguments);
      fn(err, results);
    }

    es.pipeline(es.readArray(list), flow,
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
  // master.on('error', console.log.bind(console, 'ERROR on MASTER'));

  function flows ( ) {
    function iter (item, next) {
      if (item && item.on) {
        item.on('response', function respond (elem, vars) {
          // console.log('response', elem, vars, elem.decode(vars.raw));
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
  
  var my = { };
  function chain (saw) {
    var flow = flows( );
    flow.on('close', console.log.bind(console, 'FLOW closed'));
    flow.on('error', console.log.bind(console, 'FLOW error'));
    flow.on('end', console.log.bind(console, 'FLOW end'));
    this.open = function open_chain (cb) {
      console.log('stick chain opening');
      cb = (cb && cb.call) ? cb : empty;
      var self = this;
    /*
    this.tap(function ( ) {
      console.log('initial tap required for unknown reason');
      // saw.next( );
    });
      this.tap(function ( ) { });
    */
    saw.nest(false, function ( ) {
      var next = saw.next;

      open(function (err, results) {
          console.log('OPENED', cb);
          cb.apply(self, arguments);
          next( );
        /*
        self.poll_signal(function (err, signal) {
          console.log('haha');
        });
        */
      });
      });
    }

    this.tap = function tap (cb) {
      saw.nest(cb);
    }

    this.stats = function stats (cb) {
      cb = (cb && cb.call) ? cb : empty;
      saw.nest(false, function ( ) {
        var self = this;
        var next = saw.next;
        this.tap(function ( ) {
        console.log('REQUIRED TAP STATS');
        interface_stats(function (err, results) {
          cb.apply(self, arguments);
          next( );
        }, flows( ));
        });
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
      saw.nest(false, function ( ) {
      es.pipeline(es.readArray([query]), flow, es.writeArray(done));
      });
    }

    this.loop = function (cb) {
      var end = false;
      saw.nest(false, function loop ( ) {
        cb.call(this, function ( ) {
          end = true;
        });
        this.tap(function ( ) {
          if (end) saw.next( );
          else loop.call(this);
        });
      });
    };

    this.poll_signal = function poll_signal (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var last = 0;
      var count = 0;
      var self = this;
      function handle_signal (err, signal) {
        count++;
        console.log('signal attempt', count, signal);
        if (signal > 80) {
          cb.apply(self, arguments);
          saw.next( );
          return;
        }
        if (count < 10) self.signal_status(handle_signal);
        if (count > 10) saw.next( );
      }
      self.signal_status(handle_signal);
    }

    this.sleep = function (ms) {
      saw.nest(false, function ( ) {
        setTimeout(saw.next( ), ms);
      });
    }

    this.read_packet = function read_packet (size, cb) {
      cb = (cb && cb.call) ? cb : empty;
      console.log('create ReadPacket with size', size, my.size( ), my, my.status);
      var query = es.readArray([new Command.commands.ReadPacket(size)]);
      var self = this;
      function done (err, results) {
        cb.apply(self, arguments);
        saw.next( );
      }
      saw.nest(false, function ( ) {
        es.pipeline(query, flow, es.writeArray(done));
      });
    }

    my.size = (function (new_size) {
      console.log("NEW SIZE", new_size, 'OLD SIZE', this.status.size);
      if (Number.isFinite(new_size)) {
        this._size = new_size;
        return (this.status.size = (Number.isFinite(new_size) ? new_size : this.status.size));
      }
      return this._size;

    }).bind(my);

    this.poll_size = function (command, cb) {
      var self = this;
      my.poll_attempt = 0;
      console.log("POLL BEGIN");
      saw.nest(false, function ( ) {
      this.loop(function (end) {
        my.poll_attempt++;
        this.status(function (err, stats) {
          console.log("POLL ATTEMPT", my.poll_attempt, err, stats, my.status);
          my.status = stats;
          my.size(stats.size);
          this.tap(function ( ) {
            // if command should read this
            console.log('poll status', stats);
            if (my.poll_attempt > 40 && stats.size == 0) {
              end( );
              // saw.next( );
              return;
            }
            if (stats.size >= 14) {
              if (true || command.readable(stats)) {
                end( );
                console.log("END POLL");
                if (cb && cb.call) {
                  cb.call(this, command, stats);
                  // saw.next( );
                }
              }
            }
          });
        });
      }).tap(function ( ) {
        console.log("END POLL ONLY HAPPENS EOP");
        saw.next( );
      });
      });
    }

    this.operate = function operate (operation, cb) {
      this.tap(function ( ) {
        var query = es.readArray([ operation ]);
        function done (err, results) {
          console.log("OPERATION", "RESULT", operation, results);
          if (cb && cb.call) cb.apply(self, arguments);
          saw.next( );
        }
        es.pipeline(query, flow, es.writeArray(done));
      });
    }

    this.transmit = function transmit_packet (command, cb) {
      cb = (cb && cb.call) ? cb : empty;
      console.log("SENDING", "TRANSMIT", command.opts, command.expected, my);
      var packet = new Command.commands.TransmitPacket(command);
      var self = this;
      saw.nest(false, function ( ) {
          console.log("TRANSMIT PRE TAPPED");
          function done (err, results) {
            console.log("TRANSMIT", "RESULT", command, arguments, my);
            if (cb && cb.call) cb.apply(self, arguments);
            saw.next( );
          }
          this.tap(function ( ) {
            console.log("TRANSMIT STICK TAPPED");
            exchange(packet, done);
          });
          console.log("NEST QUEUED TRANSMIT");
      });
      // this.tap(function ( ) { });
      return this;
      var query = es.readArray([packet]);
      saw.nest(false, function ( ) {
        es.pipeline(query, flows( ), es.writeArray(done));
        // this.tap(function ( ) { });
      });
      return this;
    }

    function exchange (packet, cb) {
      var query = es.readArray([packet]);
      function done (err, results) {
        console.log("EXCHANGED", "RESULT", arguments, my);
        if (cb && cb.call) cb(err, results);
      }
      console.log("initing exchange pipeline");
      es.pipeline(query, flows( ), es.writeArray(done));
      return ;
    }

    this.download = function (command, cb) {
      var self = this;
      my.download_attempt = 0;
      saw.nest(false, function ( ) {
      var next = saw.next;
      this.loop(function (end) {
        my.download_attempt++;
        console.log('START DOWNLOAD FOR', my, command);
        // saw.nest(false, function ( ) { });
        this.poll_size(command)
          .tap(function ( ) {
            console.log("ENDING POLL SHOULD READ DATA", my, my.size( ), command);
              this.read_packet(my.size( ), function (err, data) {
                console.log('READ DATA', data, arguments, data[0]);
                command.append(data[0]);
              })
              ;
          })
          .status(console.log.bind(console, "LAST CHECK STATUS"))
          .tap(function ( ) {
            console.log('TRY TO RELEASE DOWNLOAD');
            if (command.done( )) {
              if (cb && cb.call) cb.call(this, command, my);
              my.poll_attempt = null;
              my.download_attempt = null;
              // saw.next( );
              end( )
            } else {
              if (my.download_attempt > 3) {
                my.poll_attempt = null;
                my.download_attempt = null;
                // saw.next( );
                end( );
              }
            }
          })
        ;
      }).tap(function ( ) {
        console.log("POLL END SHOULD ONLY HAPPEN ONCE PER DOWNLOAD", my);
        next( );
      });;
      });
    }

    this.status = function status (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var query = es.readArray([new Command.commands.Status( )]);
      var self = this;
      function done (err, results) {
        var r = results[0];
        my.status = r;
        my.status.size = r.size;
        console.log("DONE WITH STATUS", r, my);
        cb.call(self, err, r);
        saw.next( );
      }
      saw.nest(false, function ( ) {
      es.pipeline(query, flows( ), es.writeArray(done));
      });

    }

    this.close = function close (cb) {
      saw.nest(false, function ( ) {
      finish( );
      saw.next( );
      });
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
  function scan (open) {
    Serial.list(function (err, list) {
      var spec = list.pop( );
      console.log("OPENING", spec);
      var serial = new Serial.SerialPort(spec.comName, {bufferSize: 64});
      serial.open(open.bind(serial));
    });
  }
  // var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  scan(function ( ) {
    var serial = this;
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
