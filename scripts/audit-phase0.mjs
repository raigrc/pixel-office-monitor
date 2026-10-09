import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const inventoryPath = 'docs/archive/2026-10-09/README.md';
const inventory = readFileSync(inventoryPath, 'utf8');
const rows = [...inventory.matchAll(/^\| `([^`]+)` \| \[[^\]]+\]\(([^)]+)\) \| .*?`([a-f0-9]{40})`/gm)];
const archives = rows.map(([, original, archive, expected]) => {
  const archivedPath = path.resolve(path.dirname(inventoryPath), archive);
  const bytes = readFileSync(archivedPath);
  const blobHash = content => createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
  const exact = blobHash(bytes) === expected;
  const newlineOnly = !exact && archive.endsWith('.txt') && bytes.at(-1) === 10 && blobHash(bytes.subarray(0, -1)) === expected;
  assert(exact || newlineOnly, `Archive content mismatch: ${original}`);
  if (archive.endsWith('.txt')) assert(!existsSync(original), `Orphan still active: ${original}`);
  return { original, archive, exact, terminalLfAppended: newlineOnly };
});
assert.equal(archives.length, 24, 'Ten document and fourteen source archives');
assert.equal(archives.filter(item => item.archive.endsWith('.txt')).length, 14);
const documents = ['README.md', 'PLAN.md', 'docs/PRD.md', 'docs/ARCHITECTURE.md', 'docs/DESIGN.md', 'AGENTS.md', 'docs/character-sprite-system.md', inventoryPath];
let links = 0;
for (const document of documents) {
  const text = readFileSync(document, 'utf8');
  for (const [, target] of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|#)/.test(target)) continue;
    const file = target.split('#')[0];
    assert(existsSync(path.resolve(path.dirname(document), decodeURIComponent(file))), `Broken link in ${document}: ${target}`);
    links++;
  }
}
for (const oldDraft of ['READMEv2.md', 'PLANv2.md', 'docs/PRDv2.md', 'docs/ARCHITECTUREv2.md', 'docs/DESIGNv2.md']) assert(!existsSync(oldDraft), `Duplicate active draft: ${oldDraft}`);
const output = 'Temp/opencode/phase0';
mkdirSync(output, { recursive: true });
const credentialAudit = { checked: false, documentationMatches: 0, trackedLogMatches: 0, trackedLogFiles: 0 };
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
  const token = process.env.MONITOR_TOKEN ?? process.env.PIXEL_MONITOR_TOKEN;
  assert(token && token !== 'dev-token', 'Configured credential required for exposure audit');
  const documentedFiles = [...documents, ...archives.map(item => path.resolve(path.dirname(inventoryPath), item.archive))];
  credentialAudit.documentationMatches = documentedFiles.filter(file => readFileSync(file, 'utf8').includes(token)).length;
  const trackedLogs = execFileSync('git', ['ls-files', '-z', '--', '*.log'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  credentialAudit.trackedLogFiles = trackedLogs.length;
  credentialAudit.trackedLogMatches = trackedLogs.filter(file => existsSync(file) && readFileSync(file, 'utf8').includes(token)).length;
  assert.equal(credentialAudit.documentationMatches, 0, 'Configured credential present in documentation or archive');
  credentialAudit.checked = true;
}
writeFileSync(path.join(output, 'archive-audit.json'), JSON.stringify({ capturedAt: new Date().toISOString(), archives, validLocalLinks: links, primaryDocuments: documents.slice(0, 5), credentialAudit }, null, 2));
console.log(JSON.stringify({ documentArchives: 10, sourceArchives: 14, exactByteMatches: archives.filter(item => item.exact).length, terminalLfOnly: archives.filter(item => item.terminalLfAppended).length, validLocalLinks: links }));
