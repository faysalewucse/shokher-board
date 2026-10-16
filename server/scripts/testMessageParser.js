#!/usr/bin/env node
// Self-test for src/services/messageParser.js — run: node scripts/testMessageParser.js
const assert = require('node:assert/strict');
const { parseMessage, parseDueToken, extractMentions } = require('../src/services/messageParser');

const members = [
  { id: 'u1', name: 'Alice Smith', email: 'alice@example.com' },
  { id: 'u2', name: 'Bob', email: 'robert.jones@example.com' },
];
const labels = [
  { id: 'l1', name: 'Bug' },
  { id: 'l2', name: 'Front End' },
];
// Monday 5 Oct 2026, 10:00 local time
const now = new Date(2026, 9, 5, 10, 0, 0);
const ctx = { members, labels, now };

const ymd = (d) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isEndOfDay = (d) => d.getHours() === 23 && d.getMinutes() === 59 && d.getSeconds() === 59;

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('messageParser');

test('plain title, no tokens', () => {
  const r = parseMessage('Fix the login page', ctx);
  assert.equal(r.title, 'Fix the login page');
  assert.equal(r.description, null);
  assert.deepEqual(r.assigneeIds, []);
  assert.equal(r.dueDate, null);
});

test('@ matches name with spaces removed (case-insensitive) and email local-part', () => {
  const r = parseMessage('Review PR @alicesmith @Robert.Jones', ctx);
  assert.equal(r.title, 'Review PR');
  assert.deepEqual(r.assigneeIds, ['u1', 'u2']);
});

test('@ matches plain name, duplicates collapse, trailing punctuation kept', () => {
  const r = parseMessage('Ping @bob, then @BOB again', ctx);
  assert.deepEqual(r.assigneeIds, ['u2']);
  assert.equal(r.title, 'Ping , then again');
});

test('# matches existing label (case/space-insensitive) and collects missing ones', () => {
  const r = parseMessage('Crash on save #bug #frontend #Urgent #urgent', ctx);
  assert.equal(r.title, 'Crash on save');
  assert.deepEqual(r.labelIds, ['l1', 'l2']);
  assert.deepEqual(r.newLabelNames, ['Urgent']);
});

test('!today / !tomorrow', () => {
  let r = parseMessage('Ship it !today', ctx);
  assert.equal(ymd(r.dueDate), '2026-10-05');
  assert.ok(isEndOfDay(r.dueDate));
  assert.equal(r.title, 'Ship it');
  r = parseMessage('Ship it !tomorrow', ctx);
  assert.equal(ymd(r.dueDate), '2026-10-06');
});

test('!fri → next Friday; !mon on a Monday → next week', () => {
  assert.equal(ymd(parseMessage('x !fri', ctx).dueDate), '2026-10-09');
  assert.equal(ymd(parseMessage('x !mon', ctx).dueDate), '2026-10-12');
  assert.equal(ymd(parseMessage('x !Sunday', ctx).dueDate), '2026-10-11');
});

test('!YYYY-MM-DD and invalid dates', () => {
  const r = parseMessage('Launch !2026-10-25', ctx);
  assert.equal(ymd(r.dueDate), '2026-10-25');
  assert.ok(isEndOfDay(r.dueDate));
  const bad = parseMessage('Launch !2026-02-30', ctx);
  assert.equal(bad.dueDate, null);
  assert.equal(bad.title, 'Launch !2026-02-30');
});

test('!25oct and !25-oct; past day-month rolls to next year', () => {
  assert.equal(ymd(parseMessage('a !25oct', ctx).dueDate), '2026-10-25');
  assert.equal(ymd(parseMessage('a !25-Oct', ctx).dueDate), '2026-10-25');
  assert.equal(ymd(parseMessage('a !1jan', ctx).dueDate), '2027-01-01');
  assert.equal(parseDueToken('31feb', now), null);
});

test('multi-line: first line is title, rest is description; tokens parsed on all lines', () => {
  const r = parseMessage('Write release notes @alicesmith\nCover the new boards feature\n\nlabels: #bug !fri', ctx);
  assert.equal(r.title, 'Write release notes');
  assert.equal(r.description, 'Cover the new boards feature\n\nlabels:');
  assert.deepEqual(r.assigneeIds, ['u1']);
  assert.deepEqual(r.labelIds, ['l1']);
  assert.equal(ymd(r.dueDate), '2026-10-09');
});

test('unmatched tokens stay in the title as typed', () => {
  const r = parseMessage('Call @nobody about !someday and !13smarch', ctx);
  assert.equal(r.title, 'Call @nobody about !someday and !13smarch');
  assert.deepEqual(r.assigneeIds, []);
  assert.equal(r.dueDate, null);
});

test('emails and mid-word symbols are not tokens', () => {
  const r = parseMessage('Email bob@example.com re issue#4 now!', ctx);
  assert.equal(r.title, 'Email bob@example.com re issue#4 now!');
  assert.deepEqual(r.assigneeIds, []);
  assert.deepEqual(r.newLabelNames, []);
});

test('title made only of tokens falls back to the raw line', () => {
  const r = parseMessage('@bob !today', ctx);
  assert.equal(r.title, '@bob !today');
  assert.deepEqual(r.assigneeIds, ['u2']);
  assert.equal(ymd(r.dueDate), '2026-10-05');
});

test('CRLF line endings', () => {
  const r = parseMessage('Title #bug\r\nBody line', ctx);
  assert.equal(r.title, 'Title');
  assert.equal(r.description, 'Body line');
});

test('extractMentions for comments', () => {
  assert.deepEqual(extractMentions('Hey @Bob and @alicesmith, also @ghost', members), ['u2', 'u1']);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
