const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoomId,
  normalizeUsername,
  normalizeLanguage,
  isValidCodePayload,
  isSafeExecutableCode,
} = require('../validators');

test('normalizeRoomId accepts eight alphanumeric characters and uppercases', () => {
  assert.equal(normalizeRoomId('ab12cd34'), 'AB12CD34');
  assert.equal(normalizeRoomId(' ABCD1234 '), 'ABCD1234');
});

test('normalizeRoomId rejects invalid room IDs', () => {
  assert.equal(normalizeRoomId('short'), null);
  assert.equal(normalizeRoomId('toolong123'), null);
  assert.equal(normalizeRoomId('bad-id!!'), null);
});

test('normalizeUsername trims and enforces non-empty max length', () => {
  assert.equal(normalizeUsername('  dev_01  '), 'dev_01');
  assert.equal(normalizeUsername(''), null);
  assert.equal(normalizeUsername('a'.repeat(21)), null);
});

test('normalizeLanguage keeps supported languages and defaults unsupported values', () => {
  assert.equal(normalizeLanguage('Python'), 'python');
  assert.equal(normalizeLanguage('html'), 'html');
  assert.equal(normalizeLanguage('brainfuck'), 'javascript');
});

test('isValidCodePayload requires string payload under the size limit', () => {
  assert.equal(isValidCodePayload('console.log(1)'), true);
  assert.equal(isValidCodePayload(null), false);
  assert.equal(isValidCodePayload('x'.repeat(50001)), false);
});

test('isSafeExecutableCode rejects obvious long-running patterns', () => {
  assert.equal(isSafeExecutableCode('console.log("ok")'), true);
  assert.equal(isSafeExecutableCode('while (true) {}'), false);
  assert.equal(isSafeExecutableCode('for (;;) {}'), false);
  assert.equal(isSafeExecutableCode('setInterval(work, 0)'), false);
});
