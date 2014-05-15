
var chainsaw = require('chainsaw')
  , buffers = require('buffers')
  , EventEmitter = require('events').EventEmitter
;

var uart = require('./lib/stick/');

function session (stick) {
  var my = {stick: stick};

  /*
  stick.tap
  (
  );
  */
  function empty_tap ( ) {
    console.log('tapped');
  }

  // stick.tap(console.log.bind(console, "REQUIRED TAP, reason ???"));
  function api (saw) {
    stick.tap(console.log.bind(console, "REQUIRED TAP, reason init"));
    /*
    stick.tap(function ( ) {
      console.log('initial tap required for unknown reason');
    });
    */
    this.open = function begin ( ) {
      stick.tap(console.log.bind(console, "REQUIRED TAP, reason OPEN"))
        .open( )
        .tap(function ( ) {
          saw.nest(false, function ( ) {
            this.status(function (err, results) {
              console.log("FINISH SESSION INIT");
              saw.next( );
            });
          });
        });
      ;
      return;
      saw.nest(false, function ( ) {
      console.log("OPENING SESSION", my, this);
      var self = this;
        stick.open(function ( ) {
            // stick.poll_signal( );
            console.log('XXX', 'DEBUG', 'self', self, 'this', this);
            /*
            */
            this.stats(function (err, results) {
              console.log("FINISH SESSION INIT", results);
              my.stats = results;
              saw.next( );
            });
            return;
            var next = saw.next;
              self.status(function (err, results) {
                console.log("FINISH SESSION INIT");
                saw.next( );
                // next( );
              });
            // saw.next( );
        });
      });
      // stick.tap(function ( ) { });
      return this;
    }

    function end ( ) {
      stick.close( );
      saw.next( );
    }
    this.end = end;

    function status (cb) {
      console.log("GET STATUS");
      // stick.tap(console.log.bind(console, "REQUIRED TAP STATUS"));
      saw.nest(false, function ( ) {
        var next = saw.next;
        stick.tap(console.log.bind(console, "REQUIRED TAP STATUS"))
             .stats(function (err, results) {
          my.stats = results;
          if (cb) cb(err, my.stats);
        }).tap(function ( ) {
          console.log("FINISHING STATS");
          next( );
        });
      });

    }
    this.status = status;

    function execute (command, cb) {
      console.log("BEGIN", "EXECUTE", command);
      stick.tap(console.log.bind(console, "REQUIRED TAP EXECUTE"));
      saw.nest(false, function ( ) {
        var next = saw.next;
        // stick.tap(console.log.bind(console, "REQUIRED TAP EXECUTE"));

        stick.tap(console.log.bind(console, "REQUIRED TAP EXECUTE"))
             .transmit(command)
          .download(command)
          .tap(function ( ) {
            cb.call(this, command);
            console.log("REMOTE", command);
            next( );
          })
          ;
      });
    }
    this.exec = execute;

    function model (cb) {
      var self = this;
      saw.nest(function ( ) {
        var next = saw.next;
        this.exec(ReadPumpModel(my.serial), function (err, response) {
          console.log("FETCHED PUMP MODEL", arguments);
          if (cb && cb.call) cb.apply(this, arguments);
          // next( );
        });
      });
    }
    this.model = model;

    this.serial = function (serial) {
      my.serial = serial ? serial : my.serial;
      // this.emit('serial', my.serial);
      saw.next( );
    }

  }
  return chainsaw(api);
}
function pumpcommand (opts) {
  var self = new EventEmitter;
  self.request = request.bind(self);
  self.readable = readable.bind(self);
  self.done = done.bind(self);
  self.append = append.bind(self);
  self.opts = opts;
  self.data = buffers( );
  frames.call(self);
  sleep.call(self);
  return self;
}

function request ( ) {
  var req = {
    params: this.opts.params || [ ]
  , op: this.opts.op
  , magic: (this.opts.op == 93 ? 85 : 0)
  , retries: this.opts.retries || 3
  , pageMode: this.pageMode
  , serial: new Buffer(this.opts.serial, 'hex')
  };
  return req;
}

function frames ( ) {
  var stat = this.opts.frames ? this.opts.frames : { };
  this.expected = (stat.size || 64) * (stat.count || 1);
  this.frames = Math.ceil(this.expected / 64);
  this.pageMode = this.opts.pageMode || Math.min(this.frames, 2);
  return this;
}

function sleep ( ) {
  this.pollInterval = this.opts.poll || 100;
  this.effectTime = this.opts.effectTime || 500;
}

function append (data) {
  console.log("ZZZ", "APPEND DATA", data);
  this.data.push(data);
}

function readable (radio) {
  if (this.data.slice( ).length >= this.expected) {
    return false;
  }
  if (radio.size > 14) {
    if (this.frames < 1) {
      return true;
    }
    if (this.frames >= 1 && radio.size > 64) {
      return true;
    }
  }
  return false;
}

function done ( ) {
  if (this.data.slice( ).length >= this.expected) {
    return true;
  }
  return false;
}

function append (data) {
  // console.log('XXYYXX', 'DATA', data.toString('hex'));
  this.data.push(data);
}

function ReadPumpModel (address) {
  return pumpcommand({
    serial: address
  , op: 141
  });
}

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
  // var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  // serial.open(function ( ) {
    var serial = this;
    console.log('stick', serial);
    var driver = uart(serial);
    var pump = session(driver);
    pump.open( )
        .serial('208850')
        .status(console.log.bind(console, "STATUS", 1))
        .model(console.log.bind("MODEL NUMBER 1"))
        .status(console.log.bind(console, "STATUS", 2))
        .model(console.log.bind("MODEL NUMBER", 2))
        .status(console.log.bind(console, "STATUS", 3))
        .model(console.log.bind("MODEL NUMBER", 3))
        .status(console.log.bind(console, "STATUS", 4))
        // .model(console.log.bind("MODEL NUMBER"))
        // .status(console.log.bind(console, "STATUS"))
        .end( )
    ;
  });
}

