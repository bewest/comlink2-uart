

exports.BangLong = function (a, b, c, d) {
  return a << 24 | b << 16 | c << 8 | d;
}

exports.BangInt = function (a, b) {
  return a << 8 | b;
}

