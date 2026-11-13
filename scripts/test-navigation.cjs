/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports;
}
const { authDestination } = load('src/lib/auth-destination.ts');
const { computeProfileCompletion } = load('src/lib/profile-contract.ts');
test('normal login defaults to Home', () => {
  for (const value of [undefined, '', [], '/auth', '/unknown']) assert.equal(authDestination(value), '/');
});
test('existing destinations and job return links survive sign-in', () => {
  for (const value of ['/jobs/real-job-id', '/saved', '/applications', '/profile', '/cv-maker', '/z83', '/tools', '/hot-jobs', '/community', '/community/new', '/community/post-id', '/(tabs)/community', '/graduateroom/new', '/graduateroom/verify', '/graduateroom/post-id', '/(tabs)/jobs?province=Gauteng', '/jobs?q=Developer']) assert.equal(authDestination(value), value);
  assert.equal(authDestination(['/jobs/job-id', '/profile']), '/jobs/job-id');
});
test('external URLs, malformed paths, and auth loops fall back to Home', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/jobs%2f%2fexample.com', '/auth?returnTo=/auth', '/jobs/../auth', '/ jobs', 'javascript:alert(1)']) assert.equal(authDestination(value), '/');
});
test('profile completion uses the established contract including false preferences', () => {
  assert.equal(computeProfileCompletion(null, [], []), 0);
  const profile = { first_name:'Test', last_name:'Candidate', email:'candidate@example.test', phone:'0123456789', province:'Gauteng', city:'Pretoria', date_of_birth:'2000-01-01', address:'Test address', about:'Test summary', highest_qualification:'Degree', institution:'Test institution', field_of_study:'Computing', year_completed:'2024', skills:['A','B','C'], languages:['English'], preferred_job_types:['permanent'], preferred_province:'Gauteng', preferred_city:'Pretoria', available_immediately:false, willing_to_relocate:false };
  assert.equal(computeProfileCompletion(profile, [{}], [{kind:'cv'}, {kind:'id'}, {kind:'certificate'}]), 100);
});

const { radialLayout } = load('src/lib/radial-layout.ts');
test('six radial hit areas stay separate and inside mobile widths', () => {
  for (const width of [280, 320, 360, 390, 430, 768]) for (const scale of [1, 1.3, 2, 3]) {
    const layout = radialLayout(width, scale);
    assert.equal(layout.points.length, 6);
    for (const a of layout.points) {
      assert.ok(a.left >= 0 && a.left + layout.nodeWidth <= layout.width);
      assert.ok(a.top >= 0 && a.top + layout.nodeHeight <= layout.height);
    }
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const a = layout.points[i], b = layout.points[j];
      assert.ok(a.left + layout.nodeWidth <= b.left || b.left + layout.nodeWidth <= a.left || a.top + layout.nodeHeight <= b.top || b.top + layout.nodeHeight <= a.top, `overlap at ${width}px: ${i}, ${j}`);
    }
  }
});
