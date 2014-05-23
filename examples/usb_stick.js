var create = require('../');
var usb = require('../lib/usb');


if (!module.parent) {
  console.log('howdy');
  var stream = usb( );
  stream.on('error', function ( ) {
    console.log("BAD ERROR", arguments);
    stream.close( );
    stream.end( );
  });
  console.log(stream);
  stream.open( );
  var session = create(stream)
  session.uart.open(function (ctx) {
      console.log('opened', 'args', arguments, 'this', this);
    })
    .stats(console.log.bind(console, 'INTERFACE STATS'))
    .signal_status(console.log.bind(console, 'signal stength'))
    .poll_signal(console.log.bind(console, 'SIGNAL'))
    .status(console.log.bind(console, 'STATUS'))
    .stats(console.log.bind(console, 'INTERFACE STATS'))
    .close( )
    ;
}
