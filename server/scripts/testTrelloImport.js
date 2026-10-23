#!/usr/bin/env node
// Self-test for the Trello import mapping — run: npm run test:trello
// Covers src/services/trelloMapping.js and the portal normalizer
// (portal/src/pages/boards/trelloImport/normalizeTrello.js) against
// scripts/fixtures/trello-sample.json. No database needed.
//
// Also: `node scripts/testTrelloImport.js --payload [file]` prints the
// normalized payload for a Trello export (handy for curl testing).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const m = require('../src/services/trelloMapping');

const FIXTURE = path.join(__dirname, 'fixtures/trello-sample.json');
const NORMALIZER = path.join(__dirname, '../../portal/src/pages/boards/trelloImport/normalizeTrello.js');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

(async () => {
  const norm = await import(pathToFileURL(NORMALIZER).href);

  if (process.argv[2] === '--payload') {
    const raw = JSON.parse(fs.readFileSync(process.argv[3] || FIXTURE, 'utf8'));
    process.stdout.write(JSON.stringify(norm.normalizeTrello(raw)));
    return;
  }

  console.log('trelloMapping');

  test('label colours map onto the accepted set (variants, null, unknown)', () => {
    for (const c of m.LABEL_COLORS) assert.equal(m.mapLabelColor(c), c);
    assert.equal(m.mapLabelColor('purple_dark'), 'purple');
    assert.equal(m.mapLabelColor('sky_light'), 'sky');
    assert.equal(m.mapLabelColor('GREEN'), 'green');
    assert.equal(m.mapLabelColor(null), 'blue');
    assert.equal(m.mapLabelColor('teal'), 'blue');
  });

  test('unnamed labels are named after their colour', () => {
    assert.equal(m.labelName({ name: '', color: 'green' }), 'Green');
    assert.equal(m.labelName({ name: '  ', color: 'lime_dark' }), 'Lime');
    assert.equal(m.labelName({ name: '', color: null }), 'Label');
    assert.equal(m.labelName({ name: ' Bug ', color: 'red' }), 'Bug');
  });

  test('respace orders by pos (stable) and spaces by 1024', () => {
    const r = m.respace([{ id: 'b', pos: 2 }, { id: 'x' }, { id: 'a', pos: 1 }, { id: 'c', pos: 2 }]);
    assert.deepEqual(r.map((x) => x.item.id), ['a', 'b', 'c', 'x']);
    assert.deepEqual(r.map((x) => x.position), [1024, 2048, 3072, 4096]);
    assert.deepEqual(m.respace([{ pos: 5 }], 2).map((x) => x.position), [2048]);
  });

  test('comment body: attribution prefix unless the author is mapped', () => {
    const c = { text: 'Hello', date: '2026-03-04T10:15:00.000Z', memberCreator: { id: 'm', fullName: 'Rina Akter', username: 'rina' } };
    assert.equal(m.commentBody(c), 'Originally by Rina Akter on Trello · 2026-03-04 10:15 UTC\n\nHello');
    assert.equal(m.commentBody(c, { mapped: true }), 'Hello');
    assert.match(m.commentBody({ text: 'x', memberCreator: { username: 'bob' } }), /^Originally by bob on Trello · unknown date\n\nx$/);
  });

  test('completedAt uses due date, else now', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    assert.equal(m.completedAtFor({ dueComplete: true, due: '2026-09-15T10:00:00Z' }, now).toISOString(), '2026-09-15T10:00:00.000Z');
    assert.equal(m.completedAtFor({ dueComplete: true, due: null }, now), now);
    assert.equal(m.completedAtFor({ dueComplete: false, due: '2026-09-15T10:00:00Z' }, now), null);
  });

  test('trelloIdDate decodes ObjectId timestamps', () => {
    assert.equal(m.trelloIdDate('5f5b2b1c0000000000000000').toISOString(), '2020-09-11T07:45:32.000Z');
    assert.equal(m.trelloIdDate('not-an-id'), null);
  });

  test('attachments: http(s) ≤500 chars are linkable, others go to the description', () => {
    assert.equal(m.isLinkable({ url: 'https://x.y/a.pdf' }), true);
    assert.equal(m.isLinkable({ url: 'ftp://x.y/a.pdf' }), false);
    assert.equal(m.isLinkable({ url: `https://x.y/${'a'.repeat(600)}` }), false);
    assert.equal(m.attachmentFileName({ url: 'https://x.y/files/My%20Doc.pdf' }), 'My Doc.pdf');
    assert.equal(m.attachmentsSection([{ name: 'a', url: 'ftp://h/a' }]), 'Attachments (from Trello):\n- a: ftp://h/a');
  });

  console.log('normalizeTrello');
  const raw = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const data = norm.normalizeTrello(raw);

  test('rejects non-Trello JSON with a readable message', () => {
    assert.throws(() => norm.parseTrelloExport('{nope'), /not valid JSON/);
    assert.throws(() => norm.parseTrelloExport('{"name":"x","lists":[]}'), /missing cards/);
    assert.throws(() => norm.parseTrelloExport('[]'), /not a Trello board export/);
  });

  test('keeps only the needed fields and extracts comments from actions', () => {
    assert.equal(data.board.name, 'Website Relaunch 2026');
    assert.equal(data.lists.length, 4);
    assert.equal(data.cards.length, 12);
    assert.equal(data.comments.length, 8); // createCard action ignored
    assert.ok(!('actions' in data));
    assert.deepEqual(Object.keys(data.cards[0]).sort(), ['attachments', 'closed', 'desc', 'due', 'dueComplete', 'id', 'idChecklists', 'idLabels', 'idList', 'idMembers', 'name', 'pos', 'start'].sort());
    assert.ok(JSON.stringify(data).length < JSON.stringify(raw).length / 2);
  });

  test('members include comment-only authors (former members)', () => {
    assert.equal(data.members.length, 4);
    assert.ok(data.members.some((x) => x.fullName === 'Jamal Uddin'));
  });

  test('preview counts respect includeArchived', () => {
    const off = norm.trelloCounts(data, false);
    const on = norm.trelloCounts(data, true);
    assert.equal(off.lists, 3);
    assert.equal(off.cards, 8);
    assert.equal(on.lists, 4);
    assert.equal(on.cards, 12);
    assert.equal(off.archivedCards, 4);
  });

  test('auto-match by full name / username vs name / email local-part', () => {
    const users = [{ id: 'u1', name: 'Rina Akter', email: 'r@x.com' }, { id: 'u2', name: 'T', email: 'tanvirhasan7@x.com' }];
    assert.equal(norm.matchUser({ fullName: 'rina akter', username: 'zz' }, users).id, 'u1');
    assert.equal(norm.matchUser({ fullName: 'Tanvir H', username: 'TanvirHasan7' }, users).id, 'u2');
    assert.equal(norm.matchUser({ fullName: 'Nobody', username: 'nobody' }, users), null);
  });

  console.log('buildImportPlan');
  const rina = data.members.find((x) => x.username === 'rinaakter').id;
  let seq = 0;
  const opts = { boardId: 'B', importerId: 'ME', memberMap: { [rina]: 'U_RINA' }, now: new Date('2026-10-23T00:00:00Z'), idGen: () => `id${++seq}` };
  const plan = m.buildImportPlan(data, opts);
  const planAll = m.buildImportPlan(data, { ...opts, includeArchived: true });

  test('creates an Inbox first, then lists in Trello pos order', () => {
    assert.deepEqual(plan.lists.map((l) => [l.name, l.position, l.isInbox]), [
      ['Inbox', 1024, true], ['To Do', 2048, false], ['In Progress', 3072, false], ['Done', 4096, false],
    ]);
    assert.equal(plan.createdInbox, true);
  });

  test('archived list is skipped by default, imported archived when included', () => {
    assert.ok(!plan.lists.some((l) => l.name.startsWith('Q1')));
    const old = planAll.lists.find((l) => l.name.startsWith('Q1'));
    assert.ok(old.archivedAt);
    assert.equal(planAll.cards.filter((c) => c.listId === old.id).every((c) => c.archivedAt), true);
  });

  test('uses an existing Trello "Inbox" list instead of creating one', () => {
    const d = { ...data, lists: [...data.lists, { id: 'inb', name: 'inbox', pos: 99999, closed: false }] };
    const p = m.buildImportPlan(d, opts);
    assert.equal(p.lists.filter((l) => l.isInbox).length, 1);
    assert.equal(p.lists.find((l) => l.isInbox).name, 'inbox');
    assert.equal(p.createdInbox, false);
  });

  test('cards: order within list, archived handling, dates, completion', () => {
    const todo = plan.lists.find((l) => l.name === 'To Do');
    assert.deepEqual(plan.cards.filter((c) => c.listId === todo.id).map((c) => c.title), [
      'Set up staging environment', 'Fix broken footer links on mobile', 'Write copy for About page', 'Collect testimonials',
    ]);
    assert.equal(plan.cards.length, 8);
    assert.equal(plan.counts.archivedCards, 0);
    assert.equal(planAll.cards.length, 12);
    assert.equal(planAll.counts.archivedCards, 4);
    const hosting = plan.cards.find((c) => c.title === 'Choose hosting provider');
    assert.equal(hosting.completedAt.toISOString(), '2026-09-15T10:00:00.000Z');
    assert.equal(plan.cards.find((c) => c.title === 'Logo refresh').completedAt, opts.now);
    assert.equal(plan.cards.find((c) => c.title === 'Homepage hero redesign').startDate.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.ok(plan.cards.every((c) => c.createdById === 'ME' && c.source === 'board'));
  });

  test('labels deduped and mapped; only mapped members become assignees', () => {
    assert.equal(plan.labels.length, 8);
    assert.deepEqual(plan.labels.find((l) => l.name === 'Yellow'), { id: plan.labels.find((l) => l.name === 'Yellow').id, boardId: 'B', name: 'Yellow', color: 'yellow' });
    assert.equal(plan.labels.find((l) => l.name === 'Design').color, 'purple');
    assert.equal(plan.labels.find((l) => l.name === 'Label').color, 'blue');
    const dup = m.buildImportPlan({ ...data, labels: [...data.labels, { id: 'dupe', name: 'bug', color: 'red' }] }, opts);
    assert.equal(dup.labels.length, 8);
    assert.ok(plan.cardAssignees.every((a) => a.userId === 'U_RINA'));
    assert.ok(plan.cardAssignees.length >= 3);
    assert.deepEqual(plan.memberUserIds, ['U_RINA']);
  });

  test('checklists + items ordered, empty items dropped, assignees mapped', () => {
    assert.equal(plan.checklists.length, 3);
    const hero = plan.cards.find((c) => c.title === 'Homepage hero redesign');
    assert.deepEqual(plan.checklists.filter((c) => c.cardId === hero.id).map((c) => c.title), ['Review', 'Assets']);
    const assets = plan.checklists.find((c) => c.title === 'Assets');
    const items = plan.checklistItems.filter((i) => i.checklistId === assets.id);
    assert.deepEqual(items.map((i) => [i.text, i.isDone, i.assigneeId]), [
      ['Product photo', true, 'U_RINA'], ['Headline variants', false, 'U_RINA'], ['Mobile crop', false, null],
    ]);
    assert.equal(plan.counts.checklistItems, 8);
    const prov = plan.checklistItems.find((i) => i.text === 'Configure nginx + TLS');
    assert.equal(prov.assigneeId, null); // Tanvir is not mapped
    assert.equal(prov.dueDate.toISOString(), '2026-11-03T12:00:00.000Z');
  });

  test('comments: mapped author keeps text + date, others get the prefix and importer as author', () => {
    assert.equal(plan.comments.length, 7); // the archived card's comment is skipped
    assert.equal(planAll.comments.length, 8);
    const byRina = plan.comments.filter((c) => c.authorId === 'U_RINA');
    assert.ok(byRina.length >= 3 && byRina.every((c) => !c.body.startsWith('Originally')));
    const others = plan.comments.filter((c) => c.authorId === 'ME');
    assert.ok(others.every((c) => c.body.startsWith('Originally by ')));
    assert.ok(others.some((c) => c.body.includes('Jamal Uddin')));
    assert.ok(plan.comments.every((c) => c.createdAt instanceof Date && c.createdAt < opts.now));
  });

  test('attachments: http links become rows, others go to the description', () => {
    assert.equal(plan.attachments.length, 3);
    assert.equal(plan.attachments.find((a) => a.fileName === 'hero-v3.png').mimeType, 'image/png');
    assert.equal(plan.attachments.find((a) => a.url.includes('docs.google')).mimeType, 'application/octet-stream');
    const sitemap = planAll.cards.find((c) => c.title === 'Sitemap draft');
    assert.match(sitemap.description, /Attachments \(from Trello\):\n- sitemap\.xml: ftp:/);
  });

  test('summary sentence', () => {
    assert.equal(m.summarizeCounts(plan.counts), '3 lists, 8 cards, 8 checklist items, 7 comments, 3 attachments');
  });

  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
