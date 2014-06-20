
var create = require('../');
var usb = require('../lib/usb');
var Serial = require('serialport');

function bridge (opts) {

  var tty = new Serial.SerialPort(opts.name, {bufferSize: 64});
  // serial.open(open.bind(serial));
  var uart = usb( );
  tty.pipe(uart);
  uart.pipe(tty);
  return {tty: tty, usb: uart};

}

if (!module.parent) {
  var name = process.argv.slice(2,3).pop( );
  if (!name) {
    console.log("missing serial name");
    console.log("usage:", process.argv[1], './path/to/pty');
    process.exit(1);
  }
  var handle = bridge({name: name});
  handle.usb.open(console.log.bind(console, 'OPENED USB'));
  handle.tty.open(console.log.bind(console, 'OPENED TTY'));
  
}
