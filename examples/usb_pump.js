var create = require('../');
var usb = require('../lib/usb');

if (!module.parent) {
  var serial = process.argv.slice(2,3).pop( ) || process.env['SERIAL'];
  if (!serial) {
    console.log('usage: usb_pump.js SERIAL'); 
    process.exit(1);
  }
  console.log('howdy');
  var stream = usb( );
  stream.on('error', function ( ) {
    console.log("BAD ERROR", arguments);
    stream.close( );
    stream.end( );
  });

  stream.open( );
  var session = create(stream)

  var pump = session.session;
  pump.open(console.log.bind(console, "OPENED"))
      .serial(serial)
      .power_on_ten_minutes(console.log.bind(console, 'POWER ON'))
      .ReadPumpModel(console.log.bind(console, 'POWER ON for MODEL'))
      .end( )
  ;

}
