const test = require('node:test');
const assert = require('node:assert');
const { createUser } = require('./create-user');

test('creates a user', () => {
  assert.deepEqual(createUser({ name: 'Ada' }), { id: 1, name: 'Ada' });
});
