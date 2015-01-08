var create = require('../');
var usb = require('../lib/usb');

if (!module.parent) {
  var prog = process.argv.slice(1,2).pop( );
  var serial = process.argv.slice(2,3).pop( ) || process.env['SERIAL'];
  var units = process.argv.slice(3,4).pop( ) || .5;
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
  var bolus = {strokes: 10, units: parseFloat(units)};
  pump.open(console.log.bind(console, "OPENED"))
      .serial(serial)
      .prelude({minutes: 1})
      .ReadPumpModel(function model (res, msg) {
        console.log('MODEL', res);
        console.log("ERROR?", msg);
        if (parseInt(res) > 522) {
          bolus.strokes = 40;
        }
      })
      .Bolus(bolus, function (err, msg) {
        console.log("BOLUS!! err", err);
        console.log("BOLUS!! msg", msg);
      })
      .end( )
  ;

}
