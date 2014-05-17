comlink2-uart
=============

Pure js implementation of comlink2 serial protocol

This is a javascript port of
[decoding-carelink](http://github.com/bewest/decoding-carelink)
which is a serial protocol that allows using the Carelink USB stick to talk to
remote insulin pumps.

### Example
#### Install
```bash
$ npm install git+ssh://git@github.com:bewest/comlink2-uart.git
```
Until it's on `npm`.


#### Usage

```javascript
  var uart = require('comlink2-uart');
  // scan all serial ports
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
    var pump = uart(this).session;
    console.log("PUMP", pump);
    pump.open( )
        .serial('208850') // set the serial number
        .status(console.log.bind(console, "STATUS", 1))
        // fetch model number
        .ReadPumpModel(console.log.bind("MODEL NUMBER", 1))
        .status(console.log.bind(console, "STATUS", 4))
        // fetch model number
        .ReadPumpModel(console.log.bind("MODEL NUMBER", 2))
        .end( )
    ;
  });
```

#### WIP

Buggy code, WIP, error handling, CRC checking etc.
Should work with `net` and `serialport` transports.

