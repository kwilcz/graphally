// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Downloads [url, file] pairs, 16 at a time. curl is preferred: it honours proxy settings everywhere.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let curlFound;
function hasCurl() {
  if (curlFound === undefined) {
    try {
      execFileSync('curl', ['--version'], { stdio: 'ignore' });
      curlFound = true;
    } catch {
      curlFound = false;
    }
  }
  return curlFound;
}

const CURL_ARGS = [
  '--silent', '--show-error', '--fail', '--location', '--retry', '2', '--create-dirs',
  '--max-time', '120', '--parallel', '--parallel-max', '16', '-K', '-',
];

function curlDownload(pairs) {
  const config = pairs.map(([url, file]) => `url = "${url}"\noutput = "${file.replace(/\\/g, '/')}"`).join('\n');
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', CURL_ARGS, { stdio: ['pipe', 'ignore', 'pipe'] });
    let errors = '';
    curl.stderr.on('data', data => { errors += data; });
    curl.on('error', reject);
    const curlError = code => new Error(errors.trim().split('\n').pop() || `curl exited with ${code}`);
    curl.on('close', code => (code === 0 ? resolve() : reject(curlError(code))));
    curl.stdin.end(`${config}\n`);
  });
}

async function fetchFile([url, file]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function fetchDownload(pairs, onProgress) {
  let done = 0;
  const queue = [...pairs];
  const worker = async () => {
    for (let pair = queue.shift(); pair; pair = queue.shift()) {
      await fetchFile(pair);
      onProgress?.(++done);
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
}

export async function download(pairs, onProgress) {
  if (!hasCurl()) return fetchDownload(pairs, onProgress);
  await curlDownload(pairs);
  onProgress?.(pairs.length);
  return undefined;
}
