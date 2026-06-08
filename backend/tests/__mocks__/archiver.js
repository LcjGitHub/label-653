const { EventEmitter } = require('events');

class MockArchiver extends EventEmitter {
  constructor() {
    super();
    this.entries = [];
  }

  append(data, options) {
    this.entries.push({ data, options });
    return this;
  }

  pipe(dest) {
    return dest;
  }

  async finalize() {
    return Promise.resolve();
  }
}

module.exports = {
  create: () => new MockArchiver()
};
