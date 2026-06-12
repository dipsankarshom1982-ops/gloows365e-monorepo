// Minimal assert shim for React Native / Metro
// Replaces assert v2 which has Node.js-only internal dependencies
'use strict';

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion failed');
}

assert.ok = assert;

assert.equal = function(a, b, msg) {
  if (a != b) throw new Error(msg || a + ' == ' + b);
};
assert.notEqual = function(a, b, msg) {
  if (a == b) throw new Error(msg || a + ' != ' + b);
};
assert.strictEqual = function(a, b, msg) {
  if (a !== b) throw new Error(msg || a + ' === ' + b);
};
assert.notStrictEqual = function(a, b, msg) {
  if (a === b) throw new Error(msg || a + ' !== ' + b);
};
assert.deepEqual = function(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || 'deepEqual failed');
};
assert.notDeepEqual = function(a, b, msg) {
  if (JSON.stringify(a) === JSON.stringify(b)) throw new Error(msg || 'notDeepEqual failed');
};
assert.deepStrictEqual = assert.deepEqual;
assert.notDeepStrictEqual = assert.notDeepEqual;

assert.fail = function(msg) { throw new Error(msg || 'Assertion failed'); };
assert.throws = function(fn, _err, msg) {
  try { fn(); throw new Error(msg || 'Expected to throw'); }
  catch (e) { if (e.message === (msg || 'Expected to throw')) throw e; }
};
assert.doesNotThrow = function(fn, msg) {
  try { fn(); }
  catch (e) { throw new Error(msg || 'Expected not to throw'); }
};
assert.ifError = function(err) { if (err) throw err; };

module.exports = assert;
