
var chainsaw = require('chainsaw')
  , buffers = require('buffers')
  , EventEmitter = require('events').EventEmitter
;

var uart = require('./lib/stick/');

function session (stick) {
  var my = {stick: stick};

  stick.tap(function ( ) {
    console.log('tapped');
  });

  function api (saw) {
    this.open = function begin ( ) {
      var self = this;
      stick.open(function ( ) {
        saw.nest(function ( ) {
          // stick.poll_signal( );
          self.status(function (err, results) {
            saw.next( );
          });
          saw.next( );
        })
      });
    }

    function end ( ) {
      stick.close( );
      saw.next( );
    }
    this.end = end;

    function status (cb) {
      stick.stats(function (err, results) {
        my.stats = results;
        if (cb) cb(err, my.stats);
        saw.next( );
      });

    }
    this.status = status;

    function execute (command, cb) {
      console.log("BEGIN", "EXECUTE", command);
      stick
        .transmit(command)
        .download(command)
        .tap(function ( ) {
          cb.call(this, command);
          console.log("REMOTE", command);
          saw.next( );
        })
      ;
    }
    this.exec = execute;

    function model (cb) {
      this.exec(ReadPumpModel(my.serial), function (err, response) {
        console.log("FETCHED PUMP MODEL", arguments);
        cb.apply(this, arguments);
        saw.next( );
      })
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
    if (this.frames >= 1 && stats.size > 64) {
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
  console.log('XXYYXX', 'DATA', data.toString('hex'));
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
  var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  serial.open(function ( ) {
    console.log('stick', serial);
    var driver = uart(serial);
    var pump = session(driver);
    pump.open( )
        .serial('208850')
        .status(console.log.bind(console, "STATUS"))
        .model(console.log.bind("MODEL NUMBER"))
        .status(console.log.bind(console, "STATUS"))
        .end( )
    ;
  });
}

