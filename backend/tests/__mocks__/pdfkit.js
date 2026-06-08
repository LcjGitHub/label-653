class MockPDFDocument {
  constructor() {
    this._chunks = [];
    this._settings = {};
  }

  registerFont(name, path) {
    return this;
  }

  font(name) {
    return this;
  }

  fontSize(size) {
    return this;
  }

  fillColor(color) {
    return this;
  }

  text(text, options) {
    this._chunks.push({ type: 'text', text, options });
    return this;
  }

  moveDown(n = 1) {
    this._chunks.push({ type: 'moveDown', n });
    return this;
  }

  strokeColor(color) {
    return this;
  }

  lineWidth(width) {
    return this;
  }

  moveTo(x, y) {
    this._chunks.push({ type: 'moveTo', x, y });
    return this;
  }

  lineTo(x, y) {
    this._chunks.push({ type: 'lineTo', x, y });
    return this;
  }

  stroke() {
    this._chunks.push({ type: 'stroke' });
    return this;
  }

  pipe(dest) {
    return dest;
  }

  end() {
    this._chunks.push({ type: 'end' });
    return this;
  }
}

module.exports = MockPDFDocument;
