/**
 * Pure helpers for the "Import from Trello" flow. Runs in the browser (and
 * under plain Node for tests): validates a Trello board export (Board menu →
 * Print, export and share → Export as JSON) and reduces it to the compact
 * payload POST /boards/import/trello expects, dropping the bulky `actions`,
 * prefs, plugin data, previews, etc.
 */

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const date = (v) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : null);

/**
 * Throws an Error with a user-facing message when `json` isn't a Trello board export.
 * @param {unknown} json
 */
export function assertTrelloBoard(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('This file is not a Trello board export (expected a JSON object).');
  }
  const missing = [];
  if (typeof json.name !== 'string') missing.push('name');
  if (!Array.isArray(json.lists)) missing.push('lists');
  if (!Array.isArray(json.cards)) missing.push('cards');
  if (missing.length) {
    throw new Error(`This doesn't look like a Trello board export — missing ${missing.join(', ')}. In Trello use Board menu → Print, export and share → Export as JSON.`);
  }
}

/** Parse the raw file text; throws a readable Error on bad JSON / wrong shape. */
export function parseTrelloExport(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON. Export the board again from Trello and pick the .json file.');
  }
  assertTrelloBoard(json);
  return json;
}

const memberLite = (m) => ({ id: str(m.id), fullName: str(m.fullName), username: str(m.username) });

/**
 * Reduce a Trello board export to the import payload.
 * @param {Object} raw - parsed Trello export
 * @returns {{ board, lists, labels, members, cards, checklists, comments }}
 */
export function normalizeTrello(raw) {
  assertTrelloBoard(raw);

  const lists = arr(raw.lists).filter((l) => l?.id).map((l) => ({
    id: str(l.id), name: str(l.name), pos: num(l.pos), closed: !!l.closed,
  }));

  const labels = arr(raw.labels).filter((l) => l?.id).map((l) => ({
    id: str(l.id), name: str(l.name), color: l.color ? str(l.color) : null,
  }));

  const cards = arr(raw.cards).filter((c) => c?.id && c?.idList).map((c) => ({
    id: str(c.id),
    idList: str(c.idList),
    name: str(c.name),
    desc: str(c.desc),
    pos: num(c.pos),
    closed: !!c.closed,
    due: date(c.due),
    start: date(c.start),
    dueComplete: !!c.dueComplete,
    idLabels: arr(c.idLabels).map(str),
    idMembers: arr(c.idMembers).map(str),
    idChecklists: arr(c.idChecklists).map(str),
    attachments: arr(c.attachments).filter((a) => a?.url).map((a) => ({
      name: str(a.name || a.fileName),
      url: str(a.url),
      bytes: num(a.bytes),
      mimeType: str(a.mimeType),
      date: date(a.date),
    })),
  }));

  const checklists = arr(raw.checklists).filter((cl) => cl?.id && cl?.idCard).map((cl) => ({
    id: str(cl.id),
    idCard: str(cl.idCard),
    name: str(cl.name),
    pos: num(cl.pos),
    checkItems: arr(cl.checkItems).map((it) => ({
      name: str(it.name),
      state: it.state === 'complete' ? 'complete' : 'incomplete',
      pos: num(it.pos),
      due: date(it.due),
      idMember: it.idMember ? str(it.idMember) : null,
    })),
  }));

  const comments = arr(raw.actions)
    .filter((a) => a?.type === 'commentCard' && a.data?.card?.id)
    .map((a) => ({
      idCard: str(a.data.card.id),
      text: str(a.data.text),
      date: date(a.date),
      memberCreator: a.memberCreator?.id
        ? memberLite(a.memberCreator)
        : a.idMemberCreator ? { id: str(a.idMemberCreator), fullName: '', username: '' } : null,
    }));

  // Board members plus anyone who only appears as a comment author (e.g. a
  // former member), so every author can be mapped.
  const members = [];
  const seen = new Set();
  const addMember = (m) => {
    if (!m?.id || seen.has(m.id)) return;
    seen.add(m.id);
    members.push(memberLite(m));
  };
  arr(raw.members).forEach(addMember);
  comments.forEach((c) => addMember(c.memberCreator));

  return {
    board: { name: str(raw.name), desc: str(raw.desc) },
    lists, labels, members, cards, checklists, comments,
  };
}

/**
 * Preview counts for the options step.
 * @param {ReturnType<typeof normalizeTrello>} data
 * @param {boolean} includeArchived
 */
export function trelloCounts(data, includeArchived = false) {
  const closedLists = new Set(data.lists.filter((l) => l.closed).map((l) => l.id));
  const knownLists = new Set(data.lists.map((l) => l.id));
  const cards = data.cards.filter((c) => knownLists.has(c.idList)
    && (includeArchived || (!c.closed && !closedLists.has(c.idList))));
  const cardIds = new Set(cards.map((c) => c.id));
  const checklists = data.checklists.filter((cl) => cardIds.has(cl.idCard));
  return {
    lists: data.lists.filter((l) => includeArchived || !l.closed).length,
    archivedLists: closedLists.size,
    cards: cards.length,
    archivedCards: data.cards.filter((c) => c.closed || closedLists.has(c.idList)).length,
    labels: data.labels.length,
    checklists: checklists.length,
    checklistItems: checklists.reduce((n, cl) => n + cl.checkItems.filter((i) => i.name.trim()).length, 0),
    comments: data.comments.filter((c) => cardIds.has(c.idCard)).length,
    // Only http(s) URLs become attachment rows (others are listed in the card description).
    attachments: cards.reduce((n, c) => n + c.attachments.filter((a) => /^https?:\/\//i.test(a.url) && a.url.length <= 500).length, 0),
    members: data.members.length,
  };
}

const norm = (s) => str(s).trim().toLowerCase();

/**
 * Best-effort auto-match of a Trello member to a ShokherBoard user:
 * case-insensitive full name or username vs user name / email local-part.
 * @returns {Object|null} the matched user
 */
export function matchUser(member, users) {
  const full = norm(member.fullName);
  const username = norm(member.username);
  const compact = (s) => norm(s).replace(/[\s._-]+/g, '');
  return users.find((u) => {
    const name = norm(u.name);
    const local = norm(str(u.email).split('@')[0]);
    return (full && (full === name || full === local))
      || (username && (username === local || username === name || compact(username) === compact(u.name)));
  }) || null;
}
