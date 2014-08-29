var es = require('event-stream')
  , binary = require('binary')
  , chainsaw = require('chainsaw')
  , EventEmitter = require('events').EventEmitter
  ;
var lib = require('../../lib');
var log = require('../log')('stick');
var Command = require('./commands');

function uart (transport) {

  // set up a stream we'll use to control everything internally.
  var stream = es.through(function (d) {
    if (d.close) { this.end( ); return; }
    log.info('handling', d.describe( )); this.queue(d);
  }, function ender ( ) {
    log.info("ENDING");
    this.emit('end');
  });
  
  // copy of stream incoming from device
  var from_device = es.through(function (chunk) {this.emit('data', chunk);}
                      , function ( ) { });
  transport.pipe(from_device);

  /*
   * Most work happens here, send and process opcode.
   */
  function exec (item, next) {
    log.info('sending');

    if (item.close) {

      log.info('EXEC CLOSING');
      transport
        .on('error', log.info.bind(log, 'OOPS'));
      master.on('error', log.info.bind(log, 'OOPS'));
      stream.on('error', log.info.bind(log, 'OOPS'));
      stream.end( );
      next( );
      return;
    }

    // write the request into the transport
    transport.write(item.format( ), function written ( ) {
      log.info('reading, (wrote)', item.format( ).toString('hex'), arguments);
      // read the expected response
      var input = item.response(binary( ), function read (err, data) {
        log.info('read', arguments);
        next(null, data);
      }).tap(function (vars) {
        input.end( );
        // notify everyone that we have a response
        item.emit('response', item, vars);

        // clean up
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

      // this actually triggers the reads
      from_device.pipe(input, {end: false});
    });
  }

  // Pause stream.
  function pause (item, next) {
    log.info('pausing');
    stream.pause( );
    next(null, item);
  }

  // Resume stream.
  function resume (item, next) {
    log.info('resuming');
    next(null, item);
    stream.resume( );
  }

  // A stream processing op code requests, allows only one at a time to be
  // processed.
  var master = es.pipeline(stream, es.map(pause), es.map(exec), es.map(resume));
  master.on('end', function (err) {
    log.info('MASTER ENDED', arguments);
  });

  // Used in debugging to verify behavior.
  master.on('close', function (err) {
    log.info('CLOSED MASTER');
    transport.close(function (err) {
      log.info('CLOSED transport', arguments);
    });
  })

  master.on('end', log.info.bind(log, 'END on MASTER'));
  // master.on('error', log.info.bind(log, 'ERROR on MASTER'));

  /* A stream which synchronously processes packets, one by one.
   * This one adds the twist, that the item comes out of the stream when it has
   * results.
   */
  function flows ( ) {
    function iter (item, next) {
      if (item && item.on) {
        item.on('response', function respond (elem, vars) {
          // log.info('response', elem, vars, elem.decode(vars.raw));
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

  /*
   * Bunch of helpers.
   *
   */
  function open (cb) {
    var primer = es.readArray([
        new Command.commands.ProductInfo(log.info.bind(log, 'ProductInfo'))
      , new Command.commands.SignalStrength(log.info.bind(log, 'signal strength'))
    ]);
    es.pipeline(primer, flows( ), es.writeArray(cb));
  
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
      log.info('XXX DONE results', arguments);
      fn(err, results);
    }

    es.pipeline(es.readArray(list), flow,
                es.writeArray(done));
  }

  function finish ( ) {
    es.pipeline(es.readArray([{close:true}]), flows( ),
                es.writeArray(function (err, results) {
      log.info('FINISHED', arguments);
    }));
  }

  /*
   * API the public api is basically defined below.
   * It uses the chainsaw library to build up lists of actions to perform.
   */
  
  // Keep some internal state around here. 
  var my = { };

  function chain (saw) {
    var flow = flows( );

    // some debugging helpers
    flow.on('close', log.info.bind(log, 'FLOW closed'));
    flow.on('error', log.info.bind(log, 'FLOW error'));
    flow.on('end', log.info.bind(log, 'FLOW end'));

    // open/initialize stick
    this.open = function open_chain (cb) {
      log.info('stick chain opening');
      cb = (cb && cb.call) ? cb : empty;
      var self = this;
      saw.nest(false, function ( ) {
        var next = saw.next;

        open(function (err, results) {
          log.info('OPENED', cb);
          cb.apply(self, arguments);
          next( );
        });
      });
    }

    // do some arbitrary logic before continuing
    this.tap = function tap (cb) {
      saw.nest(cb);
    }

    this.sync = function sync (cb) {
      log.info("SYNC");
      saw.nest(false, function ( ) {
        var next = saw.next;
        cb.call(this, next);
      });
    }

    // Fetch interface stats.
    this.stats = function stats (cb) {
      cb = (cb && cb.call) ? cb : empty;
      saw.nest(false, function ( ) {
        var self = this;
        var next = saw.next;
        this.tap(function ( ) {
        log.info('REQUIRED TAP STATS');
        interface_stats(function (err, results) {
          cb.apply(self, arguments);
          next( );
        }, flows( ));
        });
      });
    }

    // Fetch signal status.
    this.signal_status = function signal_status (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var self = this;
      function done (err, results) {
        cb.apply(self, arguments);
        saw.next( );
      }
      var query = new Command.commands.SignalStrength(done);
      saw.nest(false, function ( ) {
        es.pipeline(es.readArray([query]), flows( ), es.writeArray(done));
      });
    }

    // Perform some arbitrary logic until message to end.
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

    // xxx: does not work
    this.poll_signal = function poll_signal (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var last = 0;
      var count = 0;
      var self = this;
      function handle_signal (err, signal) {
        count++;
        log.info('signal attempt', count, signal);
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
        log.info('SLEEPING ms', ms);
        var next = saw.next;
        function end ( ) { 
          log.info('ENDING SLEEP');
          next( );
        }
        setTimeout(end, ms);
      });
    }

    // Read packet of given size off the radio.
    this.read_packet = function read_packet (size, cb) {
      cb = (cb && cb.call) ? cb : empty;
      log.info('create ReadPacket with size', size, my.size( ), my, my.status);
      var query = es.readArray([new Command.commands.ReadPacket(size)]);
      var self = this;
      function done (err, results) {
        cb.call(self, err, results.pop( ));
        saw.next( );
      }
      saw.nest(false, function ( ) {
        es.pipeline(query, flow, es.writeArray(done));
      });
    }

    // Memoize the size... gets around scope issues.
    my.size = (function (new_size) {
      log.info("NEW SIZE", new_size, 'OLD SIZE', this.status.size);
      if (Number.isFinite(new_size)) {
        this._size = new_size;
        return (this.status.size = (Number.isFinite(new_size) ? new_size : this.status.size));
      }
      return this._size;

    }).bind(my);

    // Poll until expected bytes are available on the radio.
    this.poll_size = function (command, cb) {
      var self = this;
      my.poll_attempt = 0;
      log.info("POLL BEGIN", my.poll_attempt);

      saw.nest(false, function ( ) {
        var last = saw.next;
        this.loop(function (end) {
          my.poll_attempt++;
          this.status(function (err, stats) {
            log.info("POLL ATTEMPT", my.poll_attempt, err, stats, my.status);
            my.status = stats;
            my.size(stats.size);
            this.tap(function ( ) {
              // if command should read this
              // log.info('poll status', stats);
              // if (my.poll_attempt > 40 && stats.size == 0) {
              if (my.poll_attempt > 40 && stats.size == 0) {
                end( );
                return;
              }
              if (stats.size >= 14) {
                // if (true || command.readable(stats)) {
                if (command.readable(stats)) {
                  end( );
                  log.info("END POLL");
                  if (cb && cb.call) {
                    cb.call(this, command, stats);
                  }
                }
              }
            });
          });
        }).tap(function ( ) {
          log.info("END POLL ONLY HAPPENS EOP", my.status.size);
          last( );
        });
      });
    }

    // xxx: unused/untested
    this.operate = function operate (operation, cb) {
      this.tap(function ( ) {
        var query = es.readArray([ operation ]);
        function done (err, results) {
          log.info("OPERATION", "RESULT", operation, results);
          if (cb && cb.call) cb.apply(self, arguments);
          saw.next( );
        }
        es.pipeline(query, flow, es.writeArray(done));
      });
    }

    // Send one packet on the radio.
    this.transmit = function transmit_packet (command, cb) {
      cb = (cb && cb.call) ? cb : empty;
      log.info("SENDING", "TRANSMIT", command.opts, command.expected, my);
      var packet = new Command.commands.TransmitPacket(command);
      var self = this;
      saw.nest(false, function ( ) {
        log.info("TRANSMIT PRE TAPPED");
        function done (err, results) {
          log.info("TRANSMIT", "RESULT", command, arguments, my);
          if (cb && cb.call) cb.apply(self, arguments);
          saw.next( );
        }
        this.tap(function ( ) {
          log.info("TRANSMIT STICK TAPPED");
          exchange(packet, done);
        });
        log.info("NEST QUEUED TRANSMIT");
      });
      return this;
    }

    // Helper to exchange one packet.
    function exchange (packet, cb) {
      var query = es.readArray([packet]);
      function done (err, results) {
        log.info("EXCHANGED", "RESULT", arguments, my);
        if (cb && cb.call) cb(err, results);
      }
      log.info("initing exchange pipeline");
      es.pipeline(query, flows( ), es.writeArray(done));
      return ;
    }

    // Download all bytes for a remote command.
    this.download = function (command, cb) {
      var self = this;
      my.download_attempt = 0;
      saw.nest(false, function ( ) {
        var next = saw.next;
        this.loop(function (end) {
          my.download_attempt++;
          log.info('START DOWNLOAD FOR', my, command);

          this.poll_size(command)
            .tap(function ( ) {
              log.info("ENDING POLL SHOULD READ DATA", my, my.size( ), command);
              if (my.size( ) > 14)
                this.read_packet(my.size( ), function (err, data) {
                  log.info('READ DATA', data, arguments, data);
                  command.append(data.packet);
                })
                ;
            })
            .status(log.info.bind(log, "LAST CHECK STATUS"))
            .tap(function ( ) {
              log.info('TRY TO RELEASE DOWNLOAD');
              if (command.done( )) {
                if (cb && cb.call) cb.call(this, command, my);
                my.poll_attempt = null;
                my.download_attempt = null;
                end( )
              } else {
                if (my.download_attempt > command.frames) {
                  my.poll_attempt = null;
                  my.download_attempt = null;
                  end( );
                }
              }
            })
          ;
        }).tap(function ( ) {
          log.info("DOWNLOAD END SHOULD ONLY HAPPEN ONCE PER DOWNLOAD", my);
          next( );
        });
      });
    }

    // Check radio status: error, size of buffer.
    this.status = function status (cb) {
      cb = (cb && cb.call) ? cb : empty;
      var query = es.readArray([new Command.commands.Status( )]);
      var self = this;
      function done (err, results) {
        var r = results[0];
        my.status = r;
        my.status.size = r.size;
        log.info("DONE WITH STATUS", r.size, my.status.size);
        cb.call(self, err, r);
        saw.next( );
      }
      saw.nest(false, function ( ) {
        es.pipeline(query, flows( ), es.writeArray(done));
      });
    }

    // End streams.
    this.close = function close (cb) {
      saw.nest(false, function ( ) {
        finish( );
        saw.next( );
      });
    }
  }

  // return instance of api
  return chainsaw(chain);
}

function empty ( ) { }

// export our api
uart.Command = Command;
module.exports = uart;


/*
 * When run as: $ node lib/stick/index.js
 * The following block will run to help test the features of this module.
 */
if (process.env && process.env.SHELL && !module.parent) {
  var Serial = require('serialport');
  function scan (open) {
    Serial.list(function (err, list) {
      var spec = list.pop( );
      log.info("OPENING", spec);
      var serial = new Serial.SerialPort(spec.comName, {bufferSize: 64});
      serial.open(open.bind(serial));
    });
  }
  scan(function ( ) {
    var serial = this;
    log.info('stick', serial);
    var driver = uart(serial);
    driver.open(function (ctx) {
      log.info('opened', 'args', arguments, 'this', this);
    })
    .stats(log.info.bind(log, 'INTERFACE STATS'))
    .signal_status(log.info.bind(log, 'signal stength'))
    .poll_signal(log.info.bind(log, 'SIGNAL'))
    .status(log.info.bind(log, 'STATUS'))
    .stats(log.info.bind(log, 'INTERFACE STATS'))
    .close( )
    ;
  });
}
