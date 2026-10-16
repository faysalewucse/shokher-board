/**
 * Message-to-card parser (pure — no DB, no I/O). See docs/boards-contract.md.
 *
 *   parseMessage(text, { members, labels, now })
 *
 * - First line (tokens stripped) → title; remaining lines → description.
 * - `@token`  → board member whose name (spaces removed, case-insensitive) or
 *               email local-part matches.
 * - `#token`  → board label whose name matches (case-insensitive, spaces
 *               ignored); missing labels are returned in `newLabelNames`.
 * - `!today`, `!tomorrow`, `!mon`…`!sun` (next such day, strictly after today),
 *   `!YYYY-MM-DD`, `!25oct` / `!25-oct` → due date (end of that day, server time).
 * - Unmatched tokens stay in the text exactly as typed.
 *
 * A token must start the line or follow whitespace, so emails like a@b.com and
 * URLs with # fragments are left alone. Trailing punctuation (,.;:?) is not
 * part of the token and is preserved.
 */

const TOKEN_RE = /(^|\s)([@#!])([^\s@#!]+?)([,.;:?)]*)(?=\s|$)/g;

const WEEKDAYS = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Build a local date and reject overflow (e.g. Feb 30 → Mar 2).
const makeDate = (y, m, d) => {
  const x = new Date(y, m, d);
  if (x.getFullYear() !== y || x.getMonth() !== m || x.getDate() !== d) return null;
  return x;
};

/**
 * Parse a `!token` body into an end-of-day Date, or null if not a date token.
 * @param {string} raw - token without the leading "!"
 * @param {Date} now
 */
const parseDueToken = (raw, now = new Date()) => {
  const t = raw.toLowerCase();

  if (t === 'today') return endOfDay(now);
  if (t === 'tomorrow' || t === 'tmr') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return endOfDay(d);
  }

  if (t in WEEKDAYS) {
    const target = WEEKDAYS[t];
    const d = new Date(now);
    let delta = (target - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7; // "next such day" — strictly after today
    d.setDate(d.getDate() + delta);
    return endOfDay(d);
  }

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) {
    const d = makeDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d ? endOfDay(d) : null;
  }

  m = /^(\d{1,2})-?([a-z]{3,4})$/.exec(t);
  if (m && m[2] in MONTHS) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    let d = makeDate(now.getFullYear(), month, day);
    if (!d) return null;
    // A day-month that already passed this year means next year.
    if (d < startOfDay(now)) d = makeDate(now.getFullYear() + 1, month, day);
    return d ? endOfDay(d) : null;
  }

  return null;
};

/**
 * Find the member referenced by an @token.
 * @param {string} token - without "@"
 * @param {Array<{id,name,email}>} members
 */
const matchMember = (token, members = []) => {
  const t = norm(token);
  if (!t) return null;
  return (
    members.find((u) => norm(u.name) === t) ||
    members.find((u) => norm(String(u.email || '').split('@')[0]) === t) ||
    null
  );
};

/**
 * @param {string} text
 * @param {Object} ctx
 * @param {Array<{id,name,email}>} ctx.members - board members (users)
 * @param {Array<{id,name}>} ctx.labels - board labels
 * @param {Date} [ctx.now]
 * @returns {{ title: string, description: string|null, assigneeIds: string[],
 *             labelIds: string[], newLabelNames: string[], dueDate: Date|null }}
 */
const parseMessage = (text, { members = [], labels = [], now = new Date() } = {}) => {
  const assigneeIds = [];
  const labelIds = [];
  const newLabelNames = [];
  let dueDate = null;

  const seenNewLabels = new Set();

  const replaceTokens = (line) =>
    line.replace(TOKEN_RE, (whole, lead, sigil, body, trail) => {
      if (sigil === '@') {
        const user = matchMember(body, members);
        if (!user) return whole;
        if (!assigneeIds.includes(user.id)) assigneeIds.push(user.id);
        return lead + trail;
      }
      if (sigil === '#') {
        const label = labels.find((l) => norm(l.name) === norm(body));
        if (label) {
          if (!labelIds.includes(label.id)) labelIds.push(label.id);
        } else if (!seenNewLabels.has(norm(body))) {
          seenNewLabels.add(norm(body));
          newLabelNames.push(body);
        }
        return lead + trail;
      }
      // "!"
      const due = parseDueToken(body, now);
      if (!due) return whole;
      dueDate = due; // last valid date token wins
      return lead + trail;
    });

  const clean = (line) => line.replace(/[ \t]{2,}/g, ' ').trim();

  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const firstRaw = lines[0] || '';
  let title = clean(replaceTokens(firstRaw));
  const rest = lines.slice(1).map((l) => replaceTokens(l).replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, ''));

  // Title can't be empty: fall back to the line as typed (or the first non-empty line).
  if (!title) title = clean(firstRaw) || clean(rest.find((l) => l.trim()) || '') || 'Untitled';

  const description = rest.join('\n').trim() || null;

  return { title, description, assigneeIds, labelIds, newLabelNames, dueDate };
};

/**
 * Extract members mentioned in a comment body (`@Name`). Used for notifications.
 * @returns {string[]} user ids
 */
const extractMentions = (body, members = []) => {
  const ids = [];
  String(body || '').replace(TOKEN_RE, (whole, lead, sigil, token) => {
    if (sigil === '@') {
      const u = matchMember(token, members);
      if (u && !ids.includes(u.id)) ids.push(u.id);
    }
    return whole;
  });
  return ids;
};

module.exports = { parseMessage, parseDueToken, matchMember, extractMentions };
