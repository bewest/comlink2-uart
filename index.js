
var uart = require('./lib/stick/');
var session = require('./lib/session/');

function create (transport, fn) {
  var my = { uart: uart(transport) };
  my.session = session(my.uart);
  if (fn && fn.call) my.session.tap(fn.bind(my.session, my));
  return my;
}
create.uart = uart;
create.session = session;

module.exports = create;

if (process.env && process.env.SHELL && !module.parent) {
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
        .serial(process.env['REMOTE_SERIAL'] || '208850')
        .status(console.log.bind(console, "STATUS", 1))
        .power_on_ten_minutes(console.log.bind(console, "SET POWER ON"))
        .ReadPumpModel(console.log.bind(console, "MODEL NUMBER", 1))
        .status(console.log.bind(console, "STATUS", 4))
        .ReadPumpModel(console.log.bind(console, "MODEL NUMBER", 2))
        // .model(console.log.bind("MODEL NUMBER"))
        // .status(console.log.bind(console, "STATUS"))
        .end( )
    ;
  });
}

