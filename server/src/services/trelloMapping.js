/**
 * Pure Trello → ShokherBoard mapping (no DB access) so it can be unit-tested
 * (scripts/testTrelloImport.js). `buildImportPlan` turns the normalized
 * payload produced by portal/src/pages/boards/trelloImport/normalizeTrello.js
 * into rows ready for prisma createMany. See docs/trello-import.md.
 */
const crypto = require('crypto');

const GAP = 1024; // same spacing as positionService

// Label colours the portal maps to monochrome styles (portal boardUtils LABEL_STYLES).
const LABEL_COLORS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'black'];
const DEFAULT_LABEL_COLOR = 'blue';

const LIMITS = { boardName: 200, listName: 200, labelName: 100, cardTitle: 500, checklistTitle: 200, itemText: 1000, fileName: 255, url: 500, mimeType: 255 };

/** cuid-like id (lowercase alnum, starts with "c") so rows can be linked before insert. */
let counter = 0;
const newId = () => {
  counter = (counter + 1) % 1679616; // 36^4
  return `c${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}${crypto.randomBytes(6).toString('hex')}`;
};

/** Trello colour (incl. `*_dark` / `*_light` variants and null) → accepted label colour. */
const mapLabelColor = (color) => {
  const base = String(color || '').toLowerCase().trim().replace(/_(dark|light)$/, '');
  return LABEL_COLORS.includes(base) ? base : DEFAULT_LABEL_COLOR;
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Unnamed Trello labels get their colour as name ("Green", "Sky"); colourless ones "Label". */
const labelName = (label) => {
  const name = String(label?.name || '').trim();
  if (name) return name.slice(0, LIMITS.labelName);
  const base = String(label?.color || '').toLowerCase().replace(/_(dark|light)$/, '');
  return base ? capitalize(base) : 'Label';
};

const clip = (s, max, fallback = '') => {
  const v = String(s ?? '').trim();
  return (v || fallback).slice(0, max);
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Trello ids are Mongo ObjectIds: the first 8 hex chars are the creation time (unix seconds). */
const trelloIdDate = (id) => {
  if (!/^[0-9a-f]{24}$/i.test(String(id || ''))) return null;
  const secs = parseInt(id.slice(0, 8), 16);
  return secs > 0 ? new Date(secs * 1000) : null;
};

/** Stable sort by Trello `pos` (missing/invalid pos keeps original order, at the end). */
const sortByPos = (items) => items
  .map((item, index) => ({ item, index, pos: Number.isFinite(Number(item?.pos)) ? Number(item.pos) : Infinity }))
  .sort((a, b) => (a.pos - b.pos) || (a.index - b.index))
  .map((x) => x.item);

/** Sorted copy with re-spaced positions: [{ item, position: 1024, 2048, … }]. */
const respace = (items, start = 1) => sortByPos(items).map((item, i) => ({ item, position: (i + start) * GAP }));

const formatTrelloDate = (d) => {
  const date = toDate(d);
  return date ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'unknown date';
};

const memberDisplayName = (m) => String(m?.fullName || m?.username || '').trim() || 'a Trello user';

/**
 * Comment body. Mapped authors keep the text as-is (they become the author);
 * unmapped ones get a plain-text attribution line (the portal renders comments
 * as plain text and shows this line as a caption) since the importer becomes the author.
 */
const commentBody = (comment, { mapped } = {}) => {
  const text = String(comment?.text ?? '');
  if (mapped) return text;
  return `Originally by ${memberDisplayName(comment?.memberCreator)} on Trello · ${formatTrelloDate(comment?.date)}\n\n${text}`;
};

/** completedAt from Trello's dueComplete flag. */
const completedAtFor = (card, now) => (card?.dueComplete ? (toDate(card.due) || now) : null);

const isHttpUrl = (url) => /^https?:\/\//i.test(String(url || ''));
/** Attachments that can be stored as link rows (Attachment.url is VARCHAR(500)). */
const isLinkable = (a) => isHttpUrl(a?.url) && String(a.url).length <= LIMITS.url;

const attachmentFileName = (a) => {
  const name = String(a?.name || '').trim();
  if (name) return name.slice(0, LIMITS.fileName);
  try {
    const last = decodeURIComponent(new URL(a.url).pathname.split('/').filter(Boolean).pop() || '');
    if (last) return last.slice(0, LIMITS.fileName);
  } catch { /* fall through */ }
  return 'Attachment';
};

/** Plain-text section (descriptions render as plain text) for attachments that cannot become Attachment rows. */
const attachmentsSection = (attachments) => {
  if (!attachments?.length) return '';
  const lines = attachments.map((a) => {
    const name = String(a?.name || a?.url || 'Attachment').trim();
    return a?.url && a.url !== name ? `- ${name}: ${a.url}` : `- ${name}`;
  });
  return `Attachments (from Trello):\n${lines.join('\n')}`;
};

/**
 * Build every row for the import. Pure: DB ids come from `idGen`.
 * @param {Object} data - normalized payload { board, lists, labels, members, cards, checklists, comments }
 * @param {Object} opts
 * @param {string} opts.boardId
 * @param {string} opts.importerId
 * @param {boolean} [opts.includeArchived=false]
 * @param {Object<string,string>} [opts.memberMap] - trelloMemberId → userId
 * @param {Date} [opts.now]
 * @param {Function} [opts.idGen]
 */
const buildImportPlan = (data, { boardId, importerId, includeArchived = false, memberMap = {}, now = new Date(), idGen = newId }) => {
  const userFor = (trelloId) => (trelloId && memberMap[trelloId]) || null;

  // ── Lists (+ Inbox) ──
  const trelloLists = (data.lists || []).filter((l) => includeArchived || !l.closed);
  const inboxSource = trelloLists.find((l) => !l.closed && String(l.name || '').trim().toLowerCase() === 'inbox');
  const lists = [];
  const listIdMap = new Map(); // trello list id → { id, archived }
  const offset = inboxSource ? 1 : 2; // a created Inbox takes the first slot
  if (!inboxSource) {
    lists.push({ id: idGen(), boardId, name: 'Inbox', position: GAP, isInbox: true, archivedAt: null });
  }
  for (const { item: l, position } of respace(trelloLists, offset)) {
    const id = idGen();
    const archived = !!l.closed;
    listIdMap.set(l.id, { id, archived });
    lists.push({
      id, boardId, name: clip(l.name, LIMITS.listName, 'Untitled list'), position,
      isInbox: l === inboxSource, archivedAt: archived ? now : null,
    });
  }

  // ── Labels (deduped by name + colour) ──
  const labels = [];
  const labelIdMap = new Map();
  const labelByKey = new Map();
  for (const l of data.labels || []) {
    const name = labelName(l);
    const color = mapLabelColor(l.color);
    const key = `${name.toLowerCase()}|${color}`;
    if (!labelByKey.has(key)) {
      const row = { id: idGen(), boardId, name, color };
      labelByKey.set(key, row.id);
      labels.push(row);
    }
    labelIdMap.set(l.id, labelByKey.get(key));
  }

  // ── Cards ──
  const cardsByList = new Map();
  for (const c of data.cards || []) {
    const list = listIdMap.get(c.idList);
    if (!list) continue; // list skipped (archived) or unknown
    if (c.closed && !includeArchived) continue;
    if (!cardsByList.has(c.idList)) cardsByList.set(c.idList, []);
    cardsByList.get(c.idList).push(c);
  }

  const cards = [];
  const cardAssignees = [];
  const cardLabels = [];
  const attachments = [];
  const cardIdMap = new Map();
  let archivedCards = 0;

  for (const [trelloListId, listCards] of cardsByList) {
    const list = listIdMap.get(trelloListId);
    for (const { item: c, position } of respace(listCards)) {
      const id = idGen();
      cardIdMap.set(c.id, id);
      const archived = !!c.closed || list.archived;
      if (archived) archivedCards += 1;

      const linkable = (c.attachments || []).filter(isLinkable);
      const unlinkable = (c.attachments || []).filter((a) => !isLinkable(a));
      const desc = [String(c.desc || '').trim(), attachmentsSection(unlinkable)].filter(Boolean).join('\n\n');

      const createdAt = trelloIdDate(c.id) || now;
      cards.push({
        id, boardId, listId: list.id,
        title: clip(c.name, LIMITS.cardTitle, 'Untitled card'),
        description: desc || null,
        position,
        dueDate: toDate(c.due),
        startDate: toDate(c.start),
        completedAt: completedAtFor(c, now),
        archivedAt: archived ? now : null,
        source: 'board',
        createdById: importerId,
        createdAt,
      });

      for (const userId of new Set((c.idMembers || []).map(userFor).filter(Boolean))) {
        cardAssignees.push({ cardId: id, userId });
      }
      for (const labelId of new Set((c.idLabels || []).map((x) => labelIdMap.get(x)).filter(Boolean))) {
        cardLabels.push({ cardId: id, labelId });
      }
      for (const a of linkable) {
        attachments.push({
          id: idGen(), cardId: id, uploaderId: importerId,
          fileName: attachmentFileName(a),
          url: a.url,
          mimeType: clip(a.mimeType, LIMITS.mimeType, 'application/octet-stream'),
          size: Number.isFinite(Number(a.bytes)) && Number(a.bytes) > 0 ? Math.min(Math.round(Number(a.bytes)), 2147483647) : 0,
          createdAt: toDate(a.date) || createdAt,
        });
      }
    }
  }

  // ── Checklists + items ──
  const checklists = [];
  const checklistItems = [];
  const checklistsByCard = new Map();
  for (const cl of data.checklists || []) {
    if (!cardIdMap.has(cl.idCard)) continue;
    if (!checklistsByCard.has(cl.idCard)) checklistsByCard.set(cl.idCard, []);
    checklistsByCard.get(cl.idCard).push(cl);
  }
  for (const [trelloCardId, cls] of checklistsByCard) {
    for (const { item: cl, position } of respace(cls)) {
      const id = idGen();
      checklists.push({ id, cardId: cardIdMap.get(trelloCardId), title: clip(cl.name, LIMITS.checklistTitle, 'Checklist'), position });
      for (const { item: it, position: itemPos } of respace((cl.checkItems || []).filter((x) => String(x?.name || '').trim()))) {
        checklistItems.push({
          id: idGen(), checklistId: id,
          text: clip(it.name, LIMITS.itemText),
          isDone: it.state === 'complete',
          position: itemPos,
          assigneeId: userFor(it.idMember),
          dueDate: toDate(it.due),
        });
      }
    }
  }

  // ── Comments ──
  const comments = [];
  for (const cm of data.comments || []) {
    const cardId = cardIdMap.get(cm.idCard);
    if (!cardId || !String(cm.text || '').trim()) continue;
    const authorId = userFor(cm.memberCreator?.id);
    comments.push({
      id: idGen(), cardId,
      authorId: authorId || importerId,
      body: commentBody(cm, { mapped: !!authorId }),
      createdAt: toDate(cm.date) || now,
    });
  }

  // ── Members: importer is owner; mapped users join as members ──
  const memberUserIds = [...new Set(Object.values(memberMap).filter(Boolean))].filter((u) => u !== importerId);

  const counts = {
    lists: trelloLists.length, // Trello lists imported (a created Inbox is not counted)
    cards: cards.length,
    archivedCards,
    archivedLists: lists.filter((l) => l.archivedAt).length,
    labels: labels.length,
    checklists: checklists.length,
    checklistItems: checklistItems.length,
    comments: comments.length,
    attachments: attachments.length,
    members: memberUserIds.length,
  };

  return { lists, labels, cards, cardAssignees, cardLabels, checklists, checklistItems, comments, attachments, memberUserIds, counts, createdInbox: !inboxSource };
};

/** Human summary used by the portal and the activity feed. */
const summarizeCounts = (c) => {
  const parts = [
    `${c.lists} list${c.lists === 1 ? '' : 's'}`,
    `${c.cards} card${c.cards === 1 ? '' : 's'}`,
  ];
  if (c.checklistItems) parts.push(`${c.checklistItems} checklist item${c.checklistItems === 1 ? '' : 's'}`);
  if (c.comments) parts.push(`${c.comments} comment${c.comments === 1 ? '' : 's'}`);
  if (c.attachments) parts.push(`${c.attachments} attachment${c.attachments === 1 ? '' : 's'}`);
  return parts.join(', ');
};

module.exports = {
  GAP,
  LABEL_COLORS,
  mapLabelColor,
  labelName,
  trelloIdDate,
  sortByPos,
  respace,
  commentBody,
  formatTrelloDate,
  completedAtFor,
  isLinkable,
  attachmentFileName,
  attachmentsSection,
  buildImportPlan,
  summarizeCounts,
  newId,
};
