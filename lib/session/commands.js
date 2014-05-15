
var buffers = require('buffers')
  , EventEmitter = require('events').EventEmitter
  ;

function pumpcommand (opts) {
  var self = new EventEmitter;
  self.request = request.bind(self);
  self.readable = readable.bind(self);
  self.done = done.bind(self);
  self.append = append.bind(self);
  self.opts = opts;
  self.data = buffers( );
  frames.call(self);
  sleep.call(self);
  return self;
}

function request ( ) {
  var serial = (this.serial ? this.serial : this.opts.serial);
  var req = {
    params: this.opts.params || [ ]
  , op: this.opts.op
  , magic: (this.opts.op == 93 ? 85 : 0)
  , retries: this.opts.retries || 3
  , pageMode: this.pageMode
  , serial: new Buffer(serial, 'hex')
  };
  return req;
}

function frames ( ) {
  var stat = this.opts.frames ? this.opts.frames : { };
  this.expected = (stat.size || 64) * (stat.count || 1);
  this.frames = Math.ceil(this.expected / 64);
  this.pageMode = this.opts.pageMode || Math.min(this.frames, 2);
  return this;
}

function sleep ( ) {
  this.pollInterval = this.opts.poll || 100;
  this.effectTime = this.opts.effectTime || 500;
}

function append (data) {
  console.log("ZZZ", "APPEND DATA", data);
  this.data.push(data);
}

function readable (radio) {
  if (this.data.slice( ).length >= this.expected) {
    return false;
  }
  if (radio.size > 14) {
    if (this.frames < 1) {
      return true;
    }
    if (this.frames >= 1 && radio.size > 64) {
      return true;
    }
  }
  return false;
}

function done ( ) {
  if (this.data.slice( ).length >= this.expected) {
    return true;
  }
  return false;
}

function append (data) {
  // console.log('XXYYXX', 'DATA', data.toString('hex'));
  this.data.push(data);
}

function ReadPumpModel (address) {
  return pumpcommand({
    name: 'ReadPumpModel'
  // , serial: address
  , op: 141
  });
}

ReadPumpModel.xxinstall = function install_with_callback ( ) {
  this.model = function (cb) {
    this.query(ReadPumpModel( ), function (err, response) {
      if (cb && cb.call) cb.apply(this, arguments);
    });
  };
};

function saw ( ) {
  var self = this;
  Object.keys(saw.commands).forEach(function iter (name) {
    var command = saw.commands[name];
    if (command.install && command.install.call) {
      command.install.call(self);
    } else {
      console.log('installing', name, command, self);
      self[name] = (function (command) {
        return (function (cb) {
          this.query(command( ), function (err, response) {
            if (cb && cb.call) cb.apply(this, arguments);
          });
        });
      })(command);
    }
  });
}

function empty ( ) { }

saw.commands = { };
saw.create = pumpcommand;
saw.register = function (name, func) {
  saw.commands[name] = func;
  return func;
}

saw.register('ReadPumpModel', ReadPumpModel);
// saw.register('model', ReadPumpModel);

module.exports = saw;


