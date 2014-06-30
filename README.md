comlink2-uart
=============

Pure js implementation of comlink2 serial protocol

This is a javascript port of
[decoding-carelink](http://github.com/bewest/decoding-carelink)
which is a serial protocol that allows using the Carelink USB stick to talk to
remote insulin pumps.

## Example
### Install
To use in another project:
```bash
$ npm install git+ssh://git@github.com:bewest/comlink2-uart.git
```
Until it's on `npm`.

### Windows
See windows notes:
* https://github.com/nonolith/node-usb#installation

### Mac
Make sure `brew` and `pkg-config` is installed:
* https://github.com/nonolith/node-usb#installation

```bash
# install brew
# First install 'brew' (package manager) by typing into your terminal:
ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)"
# Next type
brew install libusb pkg-config
```

### Linux
Just works.

### Install from cloned repo
Or clone the repo:
```bash
$ git clone git@github.com:bewest/comlink2-uart.git
$ npm install
```


### Usage

Should work with `net` and `serialport` transports.
The transport given to `uart` must be a bidirectional stream.
Here's an example using `serialport`.

If youclone this repo, you can run:
_replace **208850** with **your pump's serial number**_.
```bash
$ REMOTE_SERIAL=208850 node index.js
```

Or for prettier output:
```bash
$ REMOTE_SERIAL=208850 node index.js 2>&1 | ./node_modules/.bin/bunyan | less -R +F
```
Should show you a debug log of trying to power on for ten minutes,
then reading the serial number.

Or you can write your own scripts like this:

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
        .ReadPumpModel(console.log.bind(console, "MODEL NUMBER", 1))
        .status(console.log.bind(console, "STATUS", 2))
        // fetch model number
        .ReadPumpModel(console.log.bind(console, "MODEL NUMBER", 2))
        .end( )
    ;
  });
```

## Documentation
The module, `comlink2-uart` exports a function, `create`, aka `uart` in example
code above.
```javascript
  var create = require('comlink2-uart');
```
### `create (transport) ->  { session: <chainsaw>, uart: <chainsaw>}`

It returns an object like this:
`{ session: <chainsaw>, uart: <chainsaw>}`.

#### `chainsaw`
See [node-chainsaw](https://github.com/substack/node-chainsaw), which
builds up a list of actions, then calls them in order.

It exposes an api of supported actions as a `fluent` interface, which
allows us to provide a sane interface for serially queuing a bunch of
asynchronous actions.

We expose one set of commands for the usb `stick`, aka our `uart`.
The stick acts like a modem, the user must use the `uart` to issue
opcodes to check for modem status, send commands on the radio, and
correctly handle incoming radio packets.

This first api, the `uart` allows users to ignore the specifics of how
their underlying transport works.  As long as the `transport` is a
bidirectional stream, the `stick` module should allow users to queue
up opcodes to manipulate radio state using the serial protocol over
the given transport.

We expose another `chainsaw` api called `session` which allows users
to logically queue up remote commands to be exchanged with remote
equipment through the radio.  Each of these commands actually uses the
`uart` to issue dozens of commands in order to complete a single
command in a `session`.  This second api allows users to ignore the
complexity of how the modem operates, in order to meaningfully
exchange messages with remote equipment.

#### `transport` must be some Duplex stream


It must have a `write`, and `pipe` method, support `data`, `end`,
`close`, and `error` events as an `EventEmitter`, etc.  It must be a
[duplex stream](https://github.com/substack/stream-handbook#duplex)
supporting `pipe`.

```javascript
  var uart = require('comlink2-uart');
  // * choose one of these
  // USB support!
  // var transport = require('comlink2-uart/usb')( )
  // var transport = new SerialPort
  // var transport = net.createConnection( ) // untested
  // var transport = myStream( ); // any duplex stream

  var link = create(transport);
  // session
  var pump = link.session;
  var stick = link.uart;
```

#### `session`

The `session` imports all known commands and creates a fluent api
(meaning we can chain method calls to queue up remote actions).

Most users will want to write something like this:
```javascript
    // we can treat session like a remote pump:
    var pump = link.session;
    pump.open( )
        .serial('123456') // serial number of pump
        .power_on_ten_minutes(console.log.bind(console, "SET POWER ON"))
        .ReadPumpModel( ) // fetch remote pump
        .end( )           // clean up session
        ;
```

In order to exchange well defined messages as designed/supported by
the manufacturer.

##### `open (cb)`

Initializes the usb stick, confirms stick product information,
protocol compatibility, signal status, basic sanity check on usb
stick.

##### `serial (serialNumber)`

Sets the serial number of the pump used by subsequent commands to
address the intended pump.

**Users must call this method** to send messages to a pump.

##### `end ( )`

End and cleanup transport.

##### `exec (command, cb)` `->` `cb(result, command)`
Send instance of command.

##### `query (command, cb)` `->` `cb(result, command)`
Send instance of command with serial number set.

##### `ReadPumpModel (cb)` `->` `cb(model, command)`

Read the remote pump's model number.
Callback is called with `this` applied to session's scope, with the
`model` number (as ascii string) as the first parameter, and the
command itself as the second.

##### `power_on_ten_minutes ( )` `->` `cb(result, command)`
Send "power control on" command.  Should initialize RF session for ten
minutes or so.

```javascript
        pump.open( )
          .power_on_ten_minutes(console.log.bind(console, "SET POWER ON"))
          ;
```

#### `uart`

Most users won't want to use this.
This facilitates easily exchanging opcodes/messages with the modem
itself.

```javascript
    // This is an example of implementing a custom "clear radio
    // buffer" routine (untested)
    var stick = link.uart;
    stick.open( )
         .stats( )
         .status( )
         .tap(function ( ) {
           var i = 0;
           // poll status, eg 5 times
           this.loop(function (stop) {
             if (++i >= 5) { console.log("NO DATA FOUND"); stop( ); }
             else {
               this.status(function (err, stats) {
                  // if the radio size is bigger than the header, try
                  // downloading it
                 if (stats.size >= 14) {
                   this.read_packet(stats.size)
                       .tap(function (err, data) {
                         console.log("FOUND", data);
                       })
                    ;
                    stop( );
                  }

               });
             }
           });

         })
         .stats( )
         .close( )
    ;
```

##### `stats (cb)`

Query both `rf` and `usb` interface statistics.  How many
packets/messages have been exchanged?

##### `status (cb)`
Query status of radio/buffer.  Is the radio transmitting, receiving,
ready for download, in error, requesting delay?

##### `open (cb)`
Initialize radio, confirm compatibility with stick, identify usb
product information, prepare for sending/receiving bytes.

##### `read_packet (size, cb)`
Download bytes from radio buffer.

##### `transmit (command, cb)`
Transmit remote `command`.

##### `download (command, cb)`
Poll radio and download all packets for remote `command`.

##### `poll_size (command, cb)`
Poll radio status for `command`.


##### `tap (cb)`
Stop, inspect and perform some arbitrary logic.

##### `loop (cb)`
Stop, inspect and perform some arbitrary logic forever until end is
called.

##### `close`
Stop sending messages, clean up event listeners.

### `comlink2-uart/usb`
Create a `duplex` stream representing the usb transport.
**Must have [`usb`](https://github.com/nonolith/node-usb) installed**

```javascript
var createUSB = require('comlink2-uart/lib/usb');
// sniff for device, create duplex stream
var transport = createUSB( );
```
```javascript
var usb = require('comlink2-uart/lib/usb');
```
The module is a function which scans and creates the duplex stream.
Specifically, it returns an instance of `UsbSimpleDuplex` using the
device found after scanning the bus.

Our usb helpers:
#### `usb.scan`
Scan usb bus for Carelink device.  Returns usb device.

#### `usb.UsbSimpleDuplex`
Base class for our `duplex` stream.

## Examples
### Running the examples

```bash
$ node examples/usb_stick.js # just check usb diagnostics
# eg: node examples/usb_pump.js 208850
$ node examples/usb_pump.js 208850
# or use environment variable SERIAL
$ SERIAL=208850 node examples/usb_pump.js
```
Make sure SERIAL is set to your pump's serial number.

Here's an example using the usb transport with the pump api:
```javascript
var create = require('comlink2-uart');
var usb = require('comlink2-uart/lib/usb');

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
```

### Bugs

Probably many,
[file an issue](https://github.com/bewest/comlink2-uart/issues).


## LICENSE

    comlink2-uart
    Copyright (C) 2014  Ben West <bewest+insulaudit@gmail.com>

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
