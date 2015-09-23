var usb = require('usb');
var Duplex = require('readable-stream').Duplex;
var util = require('util');

function UsbSimpleDuplex (device) {
  var opts = { highWaterMark: 0 };
  Duplex.call(this, opts);
  this.device = device;
  this.initialized = false;
  return this;
}
util.inherits(UsbSimpleDuplex, Duplex);


UsbSimpleDuplex.prototype.open = function open_usb ( ) {
  // console.log("OPENING USB XX");
  this.device.open( );
  this.ep0 = find_endpoints(this.device);
  this.iface = this.device.interfaces[0];
  var kernelTouched = false;
  try {
    if (this.iface.isKernelDriverActive( )) {
      kernelTouched = true;
      this.iface.detachKernelDriver( );
    }
  } catch (e) {
    if (e.msg !== 'LIBUSB_ERROR_NOT_SUPPORTED') {
      throw e;
    }
  }
  this.iface.claim( );
  this.epIN = this.iface.endpoint(this.ep0.in.address);
  this.epOUT = this.iface.endpoint(this.ep0.out.address);
  this.initialized = true;

  var self = this;
  this.epIN.startStream(2, 64);
  this.epIN.on('data', function (data) {
    self.push(data);
  });
  this.on('end', function ( ) {
    console.log('YYY', "END USB re-attaching kernel?", kernelTouched, "XX");
    if (kernelTouched) this.iface.attachKernelDriver( );
  });
  this.on('close', function ( ) {
    console.log('YYY', "CLOSE USB", "XX");
  });
};

UsbSimpleDuplex.prototype._write = function write_usb (chunk, enc, cb) {
  // console.log('USB WRITING', chunk);
  this.epOUT.transfer(chunk, function ( ) {
    // console.log("DRAINED", chunk.length, arguments);
    cb(null, chunk.length);
  });

};

UsbSimpleDuplex.prototype._read = function read_usb (n) {
  if (n == 0) {

    // console.log('ATTEMPT _read', n, this._readableState);
    return;
  }
};

UsbSimpleDuplex.prototype.close = function close_usb ( ) {
  // console.log("CLOSING USB");
  this.epIN.stopStream( );
  this.epOUT.stopStream( );
  this.iface.release([this.epIN, this.epOUT], function released (err) {
    if (err) {
      this.emit('error', err);
    }
  });
  // this.iface.attachKernelDriver( );
  this.end( );

};

function find_endpoints (device) {
  var ifaces = device.interfaces[0];
  var ep0 = {
    in : ifaces.endpoints[1]
  , out: ifaces.endpoints[0]
  };
  return ep0;
}


function scan ( ) {
  var dev = usb.findByIds(0x0a21, 0x8001);
  return dev;
}

function create (device) {
  return new create.UsbSimpleDuplex(scan( ));
}

create.scan = scan;
create.UsbSimpleDuplex = UsbSimpleDuplex;
module.exports = create;

