var create = require('../');
var usb = require('../lib/usb');

if (!module.parent) {
  var prog = process.argv.slice(1,2).pop( );
  var serial = process.argv.slice(2,3).pop( ) || process.env['SERIAL'];
  if (!serial) {
    console.log('usage: ', prog, 'SERIAL'); 
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
      .ReadPumpModel(function model (res, msg) {
        console.log('MODEL', res);
        console.log("ERROR?", msg);
      })
      .Bolus({strokes: 10, units: .5}, function (err, msg) {
        console.log("BOLUS!! err", err);
        console.log("BOLUS!! msg", msg);
      })
      .end( )
  ;

}
