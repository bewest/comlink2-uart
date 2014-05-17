
var uart = require('./lib/stick/');
var session = require('./lib/session/');

function create (transport, fn) {
  var my = { uart: uart(transport) };
  my.session = session(my.uart);
  if (fn && fn.call) my.session.tap(fn.bind(my.session, my));
  return my;
}

module.exports = create;

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
  scan(function ( ) {
    var pump = create(this).session;
    console.log("PUMP", pump);
    pump.open( )
        .serial('208850')
        .status(console.log.bind(console, "STATUS", 1))
        .ReadPumpModel(console.log.bind("MODEL NUMBER", 1))
        .status(console.log.bind(console, "STATUS", 4))
        .ReadPumpModel(console.log.bind("MODEL NUMBER", 2))
        // .model(console.log.bind("MODEL NUMBER"))
        // .status(console.log.bind(console, "STATUS"))
        .end( )
    ;
  });
}

