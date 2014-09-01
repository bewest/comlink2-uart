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
      // .power_on_ten_minutes(console.log.bind(console, 'POWER ON'))
      .prelude({minutes: 3})
      .ReadPumpModel(function model (res, msg) {
        session.model = res;
        console.log('MODEL', res);
        console.log("ERROR?", msg);
        msg.save( );
      })
      .tap(function ( ) {
        if (session.model) {
          console.log('MODEL SUCCESS', session.model);
          console.log('asking for history');
          this.ReadHistoryData({page: 0}, function (raw, res) {
            console.log("HISTORY!! err", raw);
            console.log("RES!! res", res);
            res.save( );
          });

        } else {
          console.log("FAIL FAIL");
        }
      })
      .end( )
  ;

}
