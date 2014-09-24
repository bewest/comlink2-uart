var history = require('./history');
var binary = require('binary')
  , lib = require('../../lib')
  , parse_time = require('./times')
  ;

var eat_nulls = eat_nulls;


/*
*
*
*/

function lookup (peek) {
  if (peek >= 20) {
    return glucose(peek);
  }
  if (peek && lookup.opcodes[peek]) {
    return lookup.opcodes[peek];
  } else {
    if (peek >= 0) return unknown(peek);
  }
}
lookup.opcodes = { };

function opcode (code, body, date, decode) {
  var option = {
    code: code
  , body: body 
  , date: date 
  , decode: decode 
  , name: decode.name || 'UnconfirmedOP_' + (new Buffer([code]).toString('hex'))
  , length: body 
  };
  option.assemble = assembler(option);
  return option;
}

function assembler (option) {
  function assemble (record) {
    return this.into('record', function record (vars) {
      return this.tap(option.date || None).buffer('body', option.body);
    })
    .tap(function (vars) {
      vars.record.name = option.name;
      if (option.decode && option.decode.call) {
        option.decode(vars.record);
      }
    });
  }
  return assemble;
}

function describe (opts, fn) {
  // console.log(fn, fn.name, fn.constructor.name);
  lookup.opcodes[opts.code] = opts;
}

function glucose (op) {
  var option = {
    code: op
  , body: 0
  , decode: function (vars) {
    vars.sgv = op * 2;
  }
  , name: 'GlucoseSensorData'
  , length: 0
  };
  option.assemble = assembler(option);
  return option;
  
}

function unknown(op) {
  var option = {
    code: op
  , body: 0
  , decode: function (vars) {
  }
  , name: ['Unknown', (new Buffer([op])).toString('hex')].join('_0x')
  , length: 0
  };
  option.assemble = assembler(option);
  return option;
}

function parse ( ) {
  var json = [ ];
  var spool = [ ];
  var remainder;
  return this.loop(function (end, results) {
    this.into('record', function record (vars) {
      this.buffer('head', 1)
    })
    .tap(function (vars) {
      var code = vars.record.head[0];
      var found = lookup(code);
      if (!found) {
        // vars.json = json;
        end( );
        return json;
      }
      if (found.assemble && found.assemble.call) {
        var r = this.tap(found.assemble)
        ;
        if (!r.vars.record.date) {
          spool.unshift(r.vars.record);
        }
        if (r.vars.record.date) {
          if (r.vars.record.reset) {
            json = json.concat(spool.splice(0).map(function (v, i) {
              v.date = r.vars.record.date;
              v.offset = i;
              return v;
            }));
            spool = [ ];
          }
          json.push(r.vars.record);
        }
        delete r.vars.record;
      }
      ;
      
    })
    ;
  }).tap(function (RR) {
    this.buffer('remainder', 1024);
    RR.json = json;
  });
}

function None ( ) {
  return this;
}

function Relative (record) {
  return this;
}


function Absolute (record) {
  return this.buffer('date', 4).tap(function (vars) {
    vars.datetime = unmask_time(vars.date);
  });
}

function Reset ( ) {
  return Absolute.apply(this, arguments).tap(function (record) {
    record.reset = true;
  });
}

function p_minutes (b) {
  return (b & 0x63);
}

function p_hours (b) {
  return (b & 0x1F);
}

function p_day (b) {
  return (b & 0x1F);
}

function p_months (a, b) {
  high_nib = a >> 6;
  low_nib = b >> 6;
  return (high_nib << 2) + low_nib;
}

function unmask_time (data) {
  var seconds = 0;
  var year = parse_time.years(data[3]);
  var day = p_day(data[2]);
  var minutes = p_minutes(data[1]);
  var hours = p_hours(data[0]);
  var month = p_months(data[0], data[1]);
  var date = [year, day, month].join('-');
  var time = [hours, minutes, seconds].join(':');
  var str = [date, time].join('T');
  return str;
}

function params (num, opts) {
  opts.body = num;
  opts.align = function (vars) {
    return this;
  };
  return opts;
}

function EOF (vars) {

}

describe(opcode(0x01, 0, None, EOF));

describe(opcode(0x02, 0, Relative, function SensorWeakSignal (vars) {
}));

describe(opcode(0x03, 1, Relative, function SensorCal (vars) {
  var WAITING = { 1: 'waiting', 0: 'meter_bg_now' };
  var e = vars.body[0];
  if (e in WAITING) {
    vars.waiting = WAITING[e];
  }
}));

describe(opcode(0x08, 0, Reset, function SensorTimestamp (vars) {
}));

describe(opcode(0x0b, 0, Absolute, function SensorStatus (vars) {
}));

describe(params(10, opcode(0x0c, 0, Absolute, function DateTimeChange (vars) {
})));

describe(opcode(0x0d, 0, Absolute, function SensorSync (vars) {
}));

describe(params(1, opcode(0x0e, 0, Absolute, function CalBGForGH (vars) {
  var amount = vars.body[0];
  if (amount < 32) {
    amount = 0x100 + amount;
  }
  vars.amount = amount;

})));

describe(params(2, opcode(0x0f, 0, Reset, function SensorCalFactor (vars) {
  var factor = lib.BangInt.apply(lib, vars.body.slice(0, 2)) / 1000.0;
  vars.amount = factor;
})));

describe(opcode(0x10, 7, Absolute, function Unknown_0x10 (vars) {
}));

describe(opcode(0x13, 0, Relative, function Unknown_0x13 (vars) {
}));


function cleaned (data) {
  var packet = history.cleaned(data);
  // data = Array.prototype.slice(new Buffer(packet.data))
  var data = new Buffer(packet.data).toJSON( );
  data.reverse( );
  packet.data = data;
  return packet
};


function GlucosePage (model, data) {
  var packet = cleaned(data);
  return parse.call(binary.parse(packet.data)).vars;
}

var sample_data_1 = new Buffer(
[ '545353535352504f4e4d4c4b4b4b4948'
, '4745454443424344431342403e133c3a'
, '3938373613356b0e15dc090e343435b6'
, '170e15ea090f3537393b3f43464a4d50'
, '5356595c5f61646768696a6a6b6c6b6b'
, '6a6969686663615f5d5c5b5958565554'
, '514f4d4b494848484745441344134113'
, '4013404141403f3f3f3e3d3b3a393938'
, '3839393a3b3c3d3e3f3f403f3e3e3e3d'
, '3d3e3e3e3d3d3d3d3d3d3d3c3c3c3e41'
, '45484c4e4e4c4b494847474746464544'
, '4443424140403e3e3e3f4040403f3d3c'
, '3b3b3c780e15cd150e3c3c3d3ce0160e'
, '15db150f3e3e3d3b3937363535363637'
, '373837363432312f2d2c2a2928272625'
, '25242423232222222222232425262729'
, '2b2d2f303133341336133738393a3b3b'
, '3b3c3c3c3c3d133e133f134040414141'
, '4141414141414141424242424241403f'
, '3e3d3e3f3f3f3e3e3e3d3d3d3e3e3c3a'
, '39383635343536373736363533323232'
, '32321333331332133231313130302f2f'
, '2e2d2c2b29285f0e16c1090e28292d00'
, '190e16cd090f2f303213343638383837'
, '1336353332302f2d2c2a132927262525'
, '25262626262727282828292a2a2a2a2b'
, '2c2c2e2e2f30302f2e2e132e132d132b'
, '1329132513230e56ef0d081323132426'
, '282a2a2a292a2a2b2b2a292827252424'
, '252626262701050e56f40f080e56f50f'
, '0b0e36f60f0d0003490e16f90f0e0103'
, '0103244e170e16cc100f242525262727'
, '27272727272728292b2c2d2d2e2f3031'
, '32333313343536363637383a3c3e3f3f'
, '4041424341434544413d3b3b3a383737'
, '3533312f2e2d2d3031313130302f2f00'
, '039b0e16f9150e010301034566250e16'
, 'cc160f13413d3a3939133a133c3e1340'
, '13424613494d5053565a5d6165696c6e'
, '6f7072747676737373757a7e81838384'
, '86888886848282838384858687878586'
, '87898a8a89878583827f7c7977757474'
, '726e6b69686766676a6c6d6a61585a62'
, '6563605e5c5d626667666666686a6b6b'
, '6b685b433144545e6161605e5d5c5a59'
, '575653514e4b4a48464443413f3e3d3c'
, '133b3a37580e17eb090e34332ea5210e'
, '17f9090f2f30323538133b3d3f424547'
, '4644434240403f404141404040414243'
, '43434342403f3e3c3a38363636373737'
, '373737383a3c3f414344474c52565859'
, '59595959575555545252555a5e5f5c5b'
, '5d6065696c6e71777a7c7d7d7d7f7f7e'
, '7c7b79777573716e6b67625f5955524f'
, '4f5052555a5e60605f5d5a5858544f4f'
, '535756514f50505052565a5f64676b33'
, '0e37dd150e6e6e97cd2e0e17ea150f97'
, '9c9e958a80766d645c5855531353514f'
, '4c484440133e133e134013431348134d'
, '5255585b5c5d5d5e5f61636466696a6a'
, '6c6d6f70707070707071727475757575'
, '76716d6c6b6b6b6b6a6c727678787775'
, '767878797a7b7c7f7c756f6c6b6b6c6d'
, '6d6c6c6c6f727476770e38f90508ec70'
].join('')
, 'hex'
);

if (process.env && process.env.SHELL && !module.parent) {
  // console.log(sample_data_1);
  // var packet = cleaned(sample_data_1);
  var input = process.argv.slice(2,3).pop( );
  if (input) {
    var fs = require('fs');
    input = fs.readFileSync(input);
  } else {
    input = sample_data_1;
  }
  // console.log('input', input);
  var results = GlucosePage('522', input);
  if (results.remainder && results.remainder.length == 0) {
    var es = require('event-stream');
    es.pipeline(
      es.readArray([
      {input: new Buffer(cleaned(input).data).toString('hex')}
      ].concat(results.json))
    // , es.stringify( )
    // , process.stdout
    , es.writeArray(console.log.bind(console))
    );
  } else {
    console.log("JSON", results.json);
    console.log("CGM CRASHED", results.record);
    console.log("CGM PAGE LEFT OVER", results.remainder);
  }
  // console.log('cleaned', packet.data.length, '/', packet.raw.length);
}

