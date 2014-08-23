var logger;

try {
  var mod = 'bunyan';
  var bunyan = require(mod);
  var pack = require('../package.json');
  console.log('got bunyan');

  var root = bunyan.createLogger({ name: pack.name });

  function log_it (name, opts) {
    opts = opts ? opts : { };
    return root.child({module: name}, opts);
  }
  logger = log_it;
  logger.root = root;
} catch (e) {
  function create ( ) {
    return console;
  }
  logger = create;
}

module.exports = logger;
