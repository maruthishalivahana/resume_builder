/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local regression test. */
const assert = require('node:assert/strict');
require('tsx/cjs');
const { highlightCandidates } = require('./src/modules/job-tailoring/services/highlight-candidates.service.ts');
const { resolveHighlight } = require('./src/modules/job-tailoring/services/highlight-edit.service.ts');
function input(requirement, rawText, classification = 'STRONG') {
  return { requirement: { text: requirement }, match: { classification, evidenceIds: ['persisted-42'] },
    evidence: [{ id: 'persisted-42', text: rawText, rawText, score: 1 }], constraints: {} };
}
const cases = [
  ['CI/CD', 'CI/CD, Git.', ['CI/CD']],
  ['CI/CD', 'Built continuous integration and continuous delivery workflows.', ['continuous integration and continuous delivery']],
  ['Lead a team.', 'Led a software team.', ['Led a software team']],
  ['Maintain CI/CD pipelines.', 'Kept continuous integration and continuous delivery workflows running.', ['continuous integration and continuous delivery workflows']],
  ['Maintain database services.', 'Kept database services running.', ['database services']],
  ['Team communication.', 'Team communication and collaboration.', ['Team communication']],
  ['Node.js REST APIs', String.raw`Built \textbf{Node.js} REST APIs.`, ['REST APIs']],
  ['Redis', String.raw`\textbf{Tools:} Redis, Docker.`, ['Redis']],
  ['Python', 'No Python experience.', []],
  ['Python', 'Developed Python tools. No Python experience.', []],
  ['Java', 'No Python experience. Built Java tools.', ['Java']],
  ['React', 'Built React Native apps.', []],
  ['SQL', 'NoSQL storage.', []],
  ['Java', 'JavaScript apps.', []],
  ['AWS Lambda', 'AWS S3 reports.', [], 'PARTIAL'],
  ['Expert Python', 'Built Python scripts.', [], 'PARTIAL'],
  ['Python', String.raw`\label{Python}`, []],
  ['Python', String.raw`\textbf{Python}`, []],
  ['Python', String.raw`\resumeItem{Built Python tools.}`, []],
  ['Python', 'Python Python', []],
  ['C#', 'Used C#.', []],
  ['Rust', '\\item Used Rust tools\r\n for a café.', ['Rust']],
  ['PostgreSQL', 'Built PostgreSQL services with Docker.', ['PostgreSQL']],
  ['Elixir', 'Built Elixir services.', ['Elixir']],
];
for (const [requirement, raw, expected, classification] of cases) {
  const args = input(requirement, raw, classification);
  const candidates = highlightCandidates(args);
  assert.deepEqual(candidates.map(c => c.proposal.highlightText), expected, requirement + ': ' + raw);
  for (const candidate of candidates) {
    assert.equal(candidate.proposal.targetEvidenceId, 'persisted-42');
    const edit = resolveHighlight(candidate.proposal, args.evidence);
    assert.equal(edit.before, raw);
    assert.equal(edit.after.replace(`\\textbf{${candidate.proposal.highlightText}}`, candidate.proposal.highlightText), raw, 'Only the selected literal span changes');
  }
}
const unverified = input('Docker', 'Docker'); unverified.match.evidenceIds = [];
assert.deepEqual(highlightCandidates(unverified), []);
assert.deepEqual(highlightCandidates(input('Python', 'Built Python tools.', 'CONFLICT')), []);
console.log(`Highlight candidates: ${cases.length} span cases plus evidence-ID and conflict gates passed.`);
