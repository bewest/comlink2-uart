
var bunyan = require('bunyan');
var pack = require('../package.json');

var root = bunyan.createLogger({ name: pack.name });

function logger (name, opts) {
  opts = opts ? opts : { };
  return root.child({module: name}, opts);
}
logger.root = root;

module.exports = logger;
