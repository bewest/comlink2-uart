
var buffers = require('buffers')
  , EventEmitter = require('events').EventEmitter
  ;
var log = require('../log')('session.commands');

/***************************
 * Abstract Command base
 ***************************/

// Return a new pump command.
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

/*
 * Helpers bound
 */

// request - describe all information needed by TransmitPacket to format and
// send a packet.
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

// frames - initialize number of frames, pageMode, and expected size
function frames ( ) {
  var stat = this.opts.frames ? this.opts.frames : { };
  this.expected = (stat.size || 64) * (stat.count || 1);
  this.frames = Math.ceil(this.expected / 64);
  this.pageMode = this.opts.pageMode || Math.min(this.frames, 2);
  return this;
}

// sleep - initialize tuning variables used in sleep cycles
function sleep ( ) {
  this.pollInterval = this.opts.poll || 100;
  this.effectTime = this.opts.effectTime || 500;
}

// append - add data to the results
function append (data) {
  log.info("ZZZ", "APPEND DATA", data);
  this.data.push(data);
}

// readable - given state of the radio and progress of the command, should the
// command wait for more data or read now?
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

// done - used to determine if command's response should be downloaded
function done ( ) {
  if (this.data.slice( ).length >= this.expected) {
    return true;
  }
  return false;
}

// append - add data to results
function append (data) {
  // log.info('XXYYXX', 'DATA', data.toString('hex'));
  this.data.push(data);
}

/***************************
 * Concrete Commands
 ***************************/

// ReadPumpModel - command reads the model of remote pump
function ReadPumpModel ( ) {
  return pumpcommand({
    name: 'ReadPumpModel'
  , op: 141
  });
}

/*
ReadPumpModel.install = function install_with_callback ( ) {
  this.model = function (cb) {
    this.query(ReadPumpModel( ), function (err, response) {
      if (cb && cb.call) cb.apply(this, arguments);
    });
  };
};
*/

/*
ReadPumpModel.install = function ( ) {
  create_default_install.call(this, 'ReadPumpModel', ReadPumpModel);
};
*/

/***************************
 * Registry/module api
 ***************************/
function create_default_install (name, command) {
  this[name] = default_install(command);
}

function default_install (command) {
  return (function (cb) {
    this.query(command( ), function (err, response) {
      if (cb && cb.call) cb.apply(this, arguments);
    });
  });
}

// configure a new chainsaw with methods delegated to process each command
function saw ( ) {
  var self = this;
  Object.keys(saw.commands).forEach(function iter (name) {
    var command = saw.commands[name];
    log.info('installing', name, command, self);
    if (command.install && command.install.call) {
      command.install.call(self);
    } else {
      create_default_install.call(self, name, command);
    }
  });
}

// Table of all commands.
saw.commands = { };
// create new commands
saw.create = pumpcommand;
// add new command to table
saw.register = function (name, func) {
  saw.commands[name] = func;
  return func;
}

// creates pump.ReadPumpModel.
saw.register('ReadPumpModel', ReadPumpModel);
// saw.register('model', ReadPumpModel);

module.exports = saw;


