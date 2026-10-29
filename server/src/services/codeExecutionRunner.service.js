'use strict';

const pistonLanguages = Object.freeze({
  javascript: { language: 'javascript', filename: 'main.js' },
  python: { language: 'python', filename: 'main.py' },
  java: { language: 'java', filename: 'Main.java' },
  c: { language: 'c', filename: 'main.c' },
  cpp: { language: 'c++', filename: 'main.cpp' },
});

const requestPiston = async ({ endpoint, token, sourceCode, language, testCases, limits, fetchImpl = fetch }) => {
  const runtime = pistonLanguages[language];
  if (!runtime) {
    return { status: 'internal', stdout: '', stderr: 'This language is not available in the configured Piston runner.', exitCode: -1, durationMs: 0, results: [] };
  }

  const startedAt = Date.now();
  const maxCaseCount = 10;
  if (testCases.length > maxCaseCount) {
    return { status: 'internal', stdout: '', stderr: `This challenge has more than the supported ${maxCaseCount} test cases.`, exitCode: -1, durationMs: 0, results: [] };
  }

  const results = [];
  let overallStatus = 'ok';
  let stderr = '';
  let exitCode = 0;
  const deadline = startedAt + Math.min(60_000, (limits.timeoutMs + 12_000) * Math.max(testCases.length, 1));
  const outputLimit = Math.max(1, limits.maxOutputChars);

  for (const testCase of testCases) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      overallStatus = 'timeout';
      stderr = 'The challenge exceeded the total execution time limit.';
      exitCode = -1;
      break;
    }

    let response;
    let result;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          language: runtime.language,
          version: '*',
          files: [{ name: runtime.filename, content: sourceCode }],
          stdin: String(testCase.input || ''),
          compile_timeout: Math.min(limits.timeoutMs * 2, 10_000),
          run_timeout: Math.min(limits.timeoutMs, 5_000),
          compile_cpu_time: Math.min(limits.cpuSeconds * 2000, 10_000),
          run_cpu_time: Math.min(limits.cpuSeconds * 1000, 5_000),
          compile_memory_limit: limits.memoryMb * 1024 * 1024,
          run_memory_limit: limits.memoryMb * 1024 * 1024,
        }),
        signal: AbortSignal.timeout(Math.min(limits.timeoutMs + 7_000, remainingMs)),
      });
      if (!response.ok) throw new Error(`Piston returned HTTP ${response.status}`);
      result = await response.json();
    } catch (error) {
      const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
      overallStatus = timedOut ? 'timeout' : 'internal';
      stderr = timedOut ? 'The isolated execution service timed out.' : 'The isolated execution service is unavailable.';
      exitCode = -1;
      break;
    }

    const compile = result.compile || {};
    const run = result.run || {};
    const stageStatus = compile.status || run.status;
    if ((compile.code !== undefined && compile.code !== 0) || compile.status) {
      overallStatus = compile.status === 'TO' ? 'timeout' : compile.status === 'XX' ? 'internal' : 'compile_error';
      stderr = String([compile.stderr, compile.message].filter(Boolean).join('\n')).slice(0, outputLimit);
      exitCode = Number.isInteger(compile.code) ? compile.code : -1;
      break;
    }
    if (stageStatus) {
      overallStatus = stageStatus === 'TO' ? 'timeout' : stageStatus === 'XX' ? 'internal' : 'runtime_error';
      stderr = String([run.stderr, run.message].filter(Boolean).join('\n')).slice(0, outputLimit);
      exitCode = Number.isInteger(run.code) ? run.code : -1;
      break;
    }
    if (run.code !== 0) {
      overallStatus = 'runtime_error';
      stderr = String([run.stderr, run.message].filter(Boolean).join('\n')).slice(0, outputLimit);
      exitCode = Number.isInteger(run.code) ? run.code : -1;
      break;
    }
    results.push({ actualOutput: String(run.stdout || '').slice(0, outputLimit) });
  }

  return {
    status: overallStatus,
    stdout: results.map(({ actualOutput }) => actualOutput).join('\n').slice(0, outputLimit),
    stderr,
    exitCode,
    durationMs: Date.now() - startedAt,
    results,
  };
};

module.exports = { pistonLanguages, requestPiston };
