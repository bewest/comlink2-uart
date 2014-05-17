comlink2-uart
=============

Pure js implementation of comlink2 serial protocol

This is a javascript port of
[decoding-carelink](http://github.com/bewest/decoding-carelink)
which is a serial protocol that allows using the Carelink USB stick to talk to
remote insulin pumps.

## Example
### Install
```bash
$ npm install git+ssh://git@github.com:bewest/comlink2-uart.git
```
Until it's on `npm`.


### Usage

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

#### `transport` must be some bidirectional stream

It must have a `write`, and `pipe` method, support `data`, `end`,
`close`, and `error` events as an `EventEmitter`.


```javascript
  var uart = require('comlink2-uart');
    // var transport = new SerialPort
    // var transport = net.createConnection( )
    // var transport = myStream( );
    var link = create(transport)
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
        .ReadPumpModel( ) // fetch remote pump
        .end( )           // clean up session
        ;
```

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

#### `uart`

Most users won't want to use this.

```javascript
    // This is an example of implementing a custom "clear radio
    // buffer" routine (untested)
    var stick = link.uart;
    stick.open( )
         .stats( )
         .status( )
         .tap(function ( ) {
           var max = 5;
           var i = 0;
           // poll status 5 times
           this.loop(function (next) {
             i++;
             if (i < max) {
               this.status(function (err, stats) {
                  // if the radio size is bigger than the header, try
                  // downloading it
                  if (stats.size >= 14) {
                    this.read_packet(stats.size)
                        .tap(function (err, data) {
                          console.log("FOUND", data);
                        })
                    ;
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


### Bugs


Buggy code, WIP, error handling, CRC checking etc.
Should work with `net` and `serialport` transports.

#### will not work unless `PowerControlOn` has already been sent

Eg, by `mm-send-comm.py --init --serial 208850 sleep 0`.
Once pump is expecting to talk to you, you should be able to run the
script to talk to it.

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
