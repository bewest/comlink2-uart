

var Mask = {
  time:   0xC0
, invert: 0x3F
, year:   0x0F
, day:    0x1F
, hour:   0x1F
};

function parse_seconds (secs) {
  return secs & Mask.invert;
}

function parse_minutes (min) {
  return min & Mask.invert;
}

function parse_hours (hour) {
  return hour & Mask.hour;
}

function parse_days (day) {
  return day & Mask.day;
}

function parse_months (seconds, minutes) {
  var high = (seconds & Mask.time) >> 4;
  var low = (minutes & Mask.time) >> 6;
  return high | low;
}

function parse_years (year) {
 return (year & Mask.year) + 2000;
}

function parse (date) {
  var seconds = parse_seconds(date[0]);
  var minutes = parse_minutes(date[1]);
  var hours = parse_hours(date[2]);
  var months = parse_months(date[0], date[1]);
  var days = parse_days(date[3]);
  var years = parse_years(date[4]);
  return [ [ years, months, days ].join('-')
  , 'T', [ hours, minutes, seconds ].join(':') ].join('')
}

parse.seconds = function parse_seconds (secs) {
  return secs & Mask.invert;
};

parse.minutes = function parse_minutes (min) {
  return min & Mask.invert;
};

parse.hours = function parse_hours (hour) {
  return hour & Mask.hour;
};

parse.days = function parse_days (day) {
  return day & Mask.day;
};

parse.months = function parse_months (seconds, minutes) {
  var high = (seconds & Mask.time) >> 4;
  var low = (minutes & Mask.time) >> 6;
  return high | low;
};

parse.years = function parse_years (year) {
 return (year & Mask.year) + 2000;
};

module.exports = parse;

if (process.env && process.env.SHELL && !module.parent) {
  var sample_1 = [ 0x93, 0xd4, 0x0e, 0x10, 0x0c ];
  var sample_2 = [ 0xa6, 0xeb, 0x0b, 0x10, 0x0c ];
  var sample_3 = [ 0x95, 0xe8, 0x0e, 0x10, 0x0c ];
  console.log('1', parse(new Buffer(sample_1)));
  console.log('1', new Date(Date.parse(parse(new Buffer(sample_1)))));
  console.log('2', parse(new Buffer(sample_2)));
  console.log('3', parse(new Buffer(sample_3)));

}
