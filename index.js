

var uart = require('./lib/stick/');


if (!module.parent) {
  var Serial = require('serialport');
  var serial = new Serial.SerialPort('/dev/ttyUSB0', {bufferSize: 64});
  serial.open(function ( ) {
    console.log('stick', serial);
    var driver = uart(serial);
    driver.open(function (ctx) {
      // driver.usb_stats(console.log.bind(console, 'USB STATS'));
      console.log('opened', 'args', arguments, 'this', this);
      // driver.interface_stats(console.log.bind(console, 'INTERFACE STATS'));
      // driver.finish( );
    })
    .stats(console.log.bind(console, 'INTERFACE STATS'))
    .signal_status(console.log.bind(console, 'signal stength'))
    .poll_signal(console.log.bind(console, 'SIGNAL'))
    .status(console.log.bind(console, 'STATUS'))
    .stats(console.log.bind(console, 'INTERFACE STATS'))
    .close( )
    ;
  });
}

