
var buffers = require('buffers')
  , EventEmitter = require('events').EventEmitter
  , es = require('event-stream')
  ;
var log = require('../log')('session.commands');
var lib = require('../../lib');

/***************************
 * Abstract Command base
 ***************************/

// Return a new pump command.
function pumpcommand (opts) {
  var self = new EventEmitter;
  self.request = request.bind(self);
  self.response = response.bind(self);
  self.readable = readable.bind(self);
  self.done = done.bind(self);
  self.append = append.bind(self);
  self.opts = opts;
  self.data = buffers( );
  frames.call(self);
  sleep.call(self);
  install_save.call(self);
  return self;
}

/*
 * Helpers bound
 */

// response
function response ( ) {
  if (this.data.length > 0) {
    if (this.opts.decode && this.opts.decode.call) {
      console.log('DECODING XXX', this.data.buffers);
      return this.opts.decode.call(this, this.data.toBuffer( ));
    } else {
      return this.data;
    }
  }
  return null;
}

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

var fs = require('fs');
var path = require('path');
function install_save ( ) {
  this.save = function save_contents (opts, cb) {
    cb = Array.prototype.slice.call(arguments, -1);
    opts = Array.prototype.slice.call(arguments, 0, 1).pop( ) || { };
    var content = es.readArray(this.data.buffers);
    var name = (opts.name || this.opts.name) + (opts.ext || '.data');
    var pathname = path.join(opts.path || './', name);
    var output = fs.createWriteStream(pathname);
    if (cb && cb.call) {
      output = output.pipe(es.writeArray(cb));
    }
    es.pipeline(content, output);
  }
}

// sleep - initialize tuning variables used in sleep cycles
function sleep ( ) {
  this.pollInterval = this.opts.poll || 100;
  this.effectTime = this.opts.effectTime || 500;
}

// readable - given state of the radio and progress of the command, should the
// command wait for more data or read now?
function readable (radio) {
  if (this.data.slice( ).length >= this.expected) {
    return false;
  }
  if (radio.size >= 14) {
    if (this.frames < 2) {
      return true;
    }
    if (this.frames >= 1 && radio.size > 64) {
      return true;
    }
    if (this.frames == 0 && radio.size >= 14) {
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
  , decode: function (data) {
    var len = data[0];
    return new Buffer(data.slice(1, len+1)).toString('ascii');
  }
  });
}

function PowerControlOn (opts) {
  return pumpcommand({
    name: 'PowerControlOn'
  , op: 93
  , params: [ 0x01, opts.minutes || 0x0A ]
  , frames: { size: 1, count: 1 }
  , effectTime: 10000
  , decode: function (data) {
    return data.slice(0);
  }
  });
}

function Bolus (opts) {
  var params = (opts && opts.strokes && opts.units) ? fmt_bolus_opts(opts) : [ ];
  return pumpcommand({
    name: 'Bolus'
  , op: 66
  , params: params
  , frames: { size: 64, count: 1 }
  , effectTime: 2500
  , decode: function (data) {
    return data.slice(0);
  }
  });
}

function fmt_bolus_opts (opts) {
  var strokes = opts.strokes * opts.units;
  var params = [ strokes ];
  if (opts.strokes > 10) {
    params = [ lib.HighByte(strokes), lib.LowByte(strokes) ];
  }
  return params;
}

Bolus.install = function (saw, my) {
  this.Bolus = function (opts, cb) {
    var msg = Bolus(opts);
    this.query(msg, function (err, response) {
      if (cb && cb.call) cb.apply(this, arguments);
    });
  }

}

function prelude (saw, my) {
  this.prelude = function (opts, cb) {
    var power = { minutes: opts.minutes || 10 };
    var retries = opts.max_retries || 3;
    my.model = null;

    function fetch_model ( ) {
      return this.ReadPumpModel(function (model, response) {
        log.info('YYY', "MODEL", model, my, my.model);
        my.model = model;
      });
    }

    saw.nest(false, function ( ) {
      var next = saw.next;
      var attempts = 0;
      this.loop(function (finish) {
        attempts++;

        if (attempts > retries) {
          finish( );
          return;
        }
        log.info('PRELUDE ATTEMPT', attempts);
        fetch_model.call(this).tap(function maybe_power_on ( ) {
          log.info('MMY', "MODEL", my.model);
          log.info('ZZZ', "MAYBE MODEL", my, my.model);
          if (!my.model) {
            this.query(PowerControlOn(power));
            // , function (raw, response) { if (cb && cb.call) cb.apply(this, arguments); });
          } else {
            finish( );
          }
        });
      }).tap(function ( ) {
        if (cb && cb.call) cb.apply(this, [null, my.model, my]);
        next( );
      });

    });
  }
}

function ReadHistoryData (opts) {
  var params = (opts) ? fmt_history(opts) : [ ];
  return pumpcommand({
    name: 'ReadHistoryData'
  , op: 128
  , params: params
  , frames: { size: 64, count: 16 }
  , effectTime: 500
  , decode: function (data) {
    var decoder = require('./history').HistoryPage;
    return decoder('???', data.slice(0));
  }
  });
}

function fmt_history (opts) {
  var params = [ opts.page ];
  return params;
}

ReadHistoryData.install = function ( ) {
  this.ReadHistoryData = function (opts, cb) {
    var msg = ReadHistoryData(opts);
    this.query(msg, function (err, response) {
      if (cb && cb.call) cb.apply(this, arguments);
    });
  }

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
create_default_install('ReadPacket', ReadPumpModel);
ReadPumpModel.install = function ( ) {
  make_default_install.call(this, 'ReadPumpModel', ReadPumpModel);
};
*/

/***************************
 * Registry/module api
 ***************************/
function create_default_install (name, command) {
  return function ( ) {
    return make_default_install.call(this, name, command);
  };
}

function make_default_install (name, command) {
  return this[name] = default_install(command);
}

function default_install (command) {
  return (function (cb) {
    console.log("INIT INSTALLED QUERY");
    this.query(command( ), function (err, response) {
      console.log("QUERY DONE, cb", cb, arguments);
      if (cb && cb.call) cb.apply(this, arguments);
    });
  });
}

// configure a new chainsaw with methods delegated to process each command
// apply install to this inside the function passed to chainsaw:
// chainsaw(function ( ) { /*...*/; install.call(this, saw, my); })
function install (saw, my) {
  var self = this;
  Object.keys(install.commands).forEach(function iter (name) {
    var command = install.commands[name];
    if (command.install && command.install.call) {
      command.install.call(self, saw, my);
    } else {
      make_default_install.call(self, name, command);
    }
  });
  prelude.call(this, saw, my);
}

// Table of all commands.
install.commands = { };
// create new commands
install.create = pumpcommand;

// add new command to table
install.register = function (name, func) {
  install.commands[name] = func;
  return func;
}

// creates pump.ReadPumpModel.
install.register('ReadPumpModel', ReadPumpModel);
install.register('power_on_ten_minutes', PowerControlOn);
install.register('Bolus', Bolus);
install.register('ReadHistoryData', ReadHistoryData);
// install.register('model', ReadPumpModel);

module.exports = install;


