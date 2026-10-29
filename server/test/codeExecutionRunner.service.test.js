'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requestPiston } = require('../src/services/codeExecutionRunner.service');

const args = {
  endpoint: 'http://127.0.0.1:2000/api/v2/execute',
  sourceCode: 'print(input())',
  language: 'python',
  testCases: [{ input: 'hello' }, { input: 'world' }],
  limits: { timeoutMs: 5000, cpuSeconds: 5, memoryMb: 256, maxOutputChars: 20000 },
};

test('runs each test input in Piston without sending expected answers', async () => {
  const requests = [];
  const result = await requestPiston({
    ...args,
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ run: { code: 0, stdout: `${requests.length === 1 ? 'hello' : 'world'}\n`, status: null } }) };
    },
  });

  assert.equal(result.status, 'ok');
  assert.deepEqual(result.results, [{ actualOutput: 'hello\n' }, { actualOutput: 'world\n' }]);
  assert.deepEqual(requests.map(({ stdin }) => stdin), ['hello', 'world']);
  assert.equal(requests.every((request) => !JSON.stringify(request).includes('expectedOutput')), true);
});

test('maps Piston compile failures to a stable runner status', async () => {
  const result = await requestPiston({
    ...args,
    testCases: [{ input: 'hello' }],
    fetchImpl: async () => ({ ok: true, json: async () => ({ compile: { code: 1, stderr: 'Syntax error', status: 'RE' }, run: { code: null } }) }),
  });

  assert.equal(result.status, 'compile_error');
  assert.match(result.stderr, /Syntax error/);
  assert.deepEqual(result.results, []);
});
