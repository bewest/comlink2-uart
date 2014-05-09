
var chainsaw = require('chainsaw')
  , EventEmitter = require('event-emitter').EventEmitter
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

    function model ( ) {

      saw.next( );
    }
    this.model = model;

    function execute (command, cb) {
      /*
      stick
        .transmit(command)
        // .sleep(command.sleep)
        // .poll_size( )
        .download(command)
        .tap(function ( ) {
          cb.call(this, command);
          saw.next( );
        })
      ;
      */
    }
    this.exec = execute;

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
  self.format = format.bind(self);
  self.packet = packet.bind(self);
  self.response = response.bind(self);
  self.opts = opts;
  return self;
}

function format ( ) {
  var head = [ ];
  var buffer = new Buffer( );
}

function packet ( ) {
}

function response ( ) {
}

if (!module.parent) {
  var Serial = require('serialport');
  var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  serial.open(function ( ) {
    console.log('stick', serial);
    var driver = uart(serial);
    var pump = session(driver);
    pump.open( )
        .status(console.log.bind(console, "STATUS"))
        .status(console.log.bind(console, "STATUS"))
        .end( )
    ;
  });
}

