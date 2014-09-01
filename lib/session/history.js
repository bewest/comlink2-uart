var binary = require('binary')
  , lib = require('../../lib')
  , parse_time = require('./times')
  ;

function lookup (peek) {
  if (peek && lookup.opcodes[peek]) {
    return lookup.opcodes[peek];
  }
}
lookup.opcodes = { };

function parse ( ) {
  var json = [ ];
  var remainder;
  return this.loop(function (end, results) {
    this.into('record', function record (vars) {
      this.buffer('head', 2)
    })
    .tap(function (vars) {
      var found = lookup(vars.record.head[0]);
      // console.log('found', found, vars);
      if (!found) {
        // vars.json = json;
        end( );
        return json;
      }
      if (found.assemble && found.assemble.call) {
        var r = this.tap(found.assemble)
        ;
        json.push(r.vars.record);
        delete r.vars.record;
      }
      // this.flush( )
      ;
      
    })
    ;
  }).tap(function (RR) {
    // console.log("DONE", RR, json);
    this.buffer('remainder', 1024);
    RR.json = json;
  });
  ;
}

function stitcher (op) {
  return this.into('record', function record (vars) {
    this
      .buffer('head', op.head)
      // .tap(op.header)
      // .tap(op.dater)
      // .tap(op.body)
      .buffer('date', op.date)
      .buffer('body', op.body)
  })
  .tap(function (vars) {
    vars.op = vars.record.head[0];
    vars.name = op.name;
  });
}

function header (op) {
  function assemble (rec) {
    // console.log('assemble', rec);
    return this.into('record', function record (vars) {
      // console.log('record', vars);
      if (op.head > vars.head.length) {
        this
        .buffer('params', op.head - vars.head.length)
        ;
        
      }
      // this.buffer('head', op.head)
      this
      .buffer('date', op.date)
      .buffer('body', op.body)
      ;
    })
    .tap(function (vars) {
      // console.log('post record', vars);
      if (vars.record.date.length == 5) {
        vars.record.iso8601 = parse_time(vars.record.date);
      }
      vars.record.op = vars.record.head[0];
      vars.record.name = op.name;
      if (op.decode && op.decode.call) {
        op.decode(vars.record);
      }
    });
  }
  return assemble;
}

function dater (op) {
}

function tail (op) {
}

function opcode (code, head, date, body, decode) {
  var option = {
    code: code
  , head: head
  , date: date 
  , body: body
  , decode: decode 
  , name: decode.name || 'UnconfirmedOP_' + (new Buffer([code]).toString('hex'))
  , length: head + date + body
  };
  option.assemble = header(option);
  return option;
}

function describe (opts, fn) {
  // console.log(fn, fn.name, fn.constructor.name);
  lookup.opcodes[opts.code] = opts;
}
function CBG (vars) {
  vars.amount = vars.head[1];
  return vars;
}

describe(opcode(0x3F, 2, 5, 3, CBG));

function twos_comp (val, bits) {
  if ( (val & (1 << (bits - 1))) !== 0) {
    val = val - (1 << bits);
  }
  return val;
}

describe(opcode(0x5B, 2, 5, 13, function BolusWizard (vars) {
  // var bg = vars.head[1];
  var strokes = 10.0;
  var correction = (twos_comp(vars.body[7], 8)
                 +  twos_comp(vars.body[5] & 0x0F, 8)) / strokes;
  var bg = lib.BangInt(vars.body[1] & 0x0f, vars.head[1]);
  var wizard = {
    targets: {
      high:vars.body[12]
    , low: vars.body[4]
    }
  , bg_input: bg
  , carb_input: vars.body[0]
  , carb_ratio: vars.body[2]
  , sensitivity: vars.body[3]
  , correction_estimate: correction
  , food_estimate: vars.body[6] / strokes
  , bolus_estimate: vars.body[11] / strokes
  };
  for (x in wizard) {
    vars[x] = wizard[x];
  }
  return vars;
}));

describe(opcode(0x01, 4, 5, 0, function Bolus (vars) {
  var strokes = 10.0;
  vars.programmed = parseFloat(vars.head[1] / strokes);
  vars.amount = parseFloat(vars.params[0] / strokes);
  vars.duration = vars.params[1] * 30;
  vars.type = vars.params[1] > 0 ? 'square' : 'normal';
  return vars;
}));

describe(opcode(0x0A, 2, 5, 0, function CalBGForPH (vars) {
  var high = (vars.date[4] << 4) & 0x01;
  var low = vars.head[1];
  vars.amount = lib.BangInt(high, low);
}));

// describe(opcode(0xB6, 2, 5, 0, function NoDelivery (vars) { }));
// describe(opcode( function (vars) { }));

function eat_nulls (data) {
  while (data.slice(-1)[0] === 0) {
    data = data.slice(0, data.length - 1);
  }
  return data;
}

function cleaned (data) {
  var packet = binary.parse(data)
    .buffer('raw', 1022)
    .into('crc', function (vars) {
      this.word16bu('found')
    })
    .tap(function (vars) {
      vars.data = eat_nulls(vars.raw);
      vars.crc.expected = lib.CRC16CCITT(vars.raw);
      vars.valid = vars.crc.found == vars.crc.expected;
    })
    .vars
    ;
  return packet;
}

function HistoryPage (model, data) {
  var packet = cleaned(data);
  var json = [ ];
  return parse.call(binary.parse(packet.data)).vars;
  ;
  var encoded = packet.data.slice(0);
  var buf;
  var op;
  /*
  while (encoded.length > 0) {
    op = lookup(encoded[0]);
    console.log('considering op', op);
    if (!op) break;
    buf = encoded.slice(0, op.length);
    encoded = encoded.slice(op.length);
    json.push(stitcher.call(binary.parse(buf), op).vars);
  }
  */
  return json;
}

var sample_data_1 = new Buffer(
[ '3f1ba813897d0e8347875bdcb613091d0e00500d2d6a150000000000157d'
, '01151500b613491d0e0a8db6062c7d0e3f11b606ac7d0e8347870aeeaa1d'
, '357d0e3f1daa1dd57d0e8347875beeb81d151d0e00500d2d6a1900000000'
, '00197d011e1e00b91d551d0e000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '000000000000000000000000000000000000000000000000000000000000'
, '0000fc52' ].join('')
, 'hex'
);

if (process.env && process.env.SHELL && !module.parent) {
  // console.log(sample_data_1);
  var packet = cleaned(sample_data_1);
  console.log("HISTORY PAGE", HistoryPage('522', sample_data_1));
  console.log('cleaned', packet.data.length, '/', packet.raw.length);
}
