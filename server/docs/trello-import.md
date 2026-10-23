# Import from Trello

Boards page → **Import from Trello** (needs `BOARD_CREATE`). The user picks a Trello board export
(Trello: Board menu → *Print, export and share* → *Export as JSON*). The file is parsed **in the
browser** (`portal/src/pages/boards/trelloImport/normalizeTrello.js`) and only a compact,
normalized payload is sent — the bulky `actions`, prefs, previews and plugin data never leave the browser.

## Endpoint

`POST /api/v1/boards/import/trello` (authenticate, `BOARD_CREATE`)

```jsonc
{
  "name": "Website relaunch",          // new board name (1–200)
  "projectId": null,                   // optional
  "includeArchived": false,            // import archived lists/cards (as archived)
  "memberMap": { "<trelloMemberId>": "<userId>" },   // omit / null = don't map
  "data": {
    "board":      { "name", "desc" },
    "lists":      [{ "id", "name", "pos", "closed" }],
    "labels":     [{ "id", "name", "color" }],
    "members":    [{ "id", "fullName", "username" }],
    "cards":      [{ "id", "idList", "name", "desc", "pos", "closed", "due", "start", "dueComplete",
                     "idLabels", "idMembers", "idChecklists",
                     "attachments": [{ "name", "url", "bytes", "mimeType", "date" }] }],
    "checklists": [{ "id", "idCard", "name", "pos",
                     "checkItems": [{ "name", "state": "complete|incomplete", "pos", "due", "idMember" }] }],
    "comments":   [{ "idCard", "text", "date", "memberCreator": { "id", "fullName", "username" } }]
  }
}
```
Limits (Joi): 1000 lists, 5000 cards, 20000 checklists, 500 items per checklist, 20000 comments,
200 attachments per card. Body limit is the app-wide 50 MB JSON limit.

Response `201`: `{ board: Board (myRole 'owner'), counts: { lists, cards, archivedCards, archivedLists,
labels, checklists, checklistItems, comments, attachments, members } }`; `message` is a summary such as
"Imported 3 lists, 8 cards, 8 checklist items, 7 comments, 3 attachments".

## Mapping (`src/services/trelloMapping.js`, pure — tested by `npm run test:trello`)

| Trello | ShokherBoard |
|---|---|
| Board | New board; importer = creator + `owner`; mapped users join as `member` |
| Lists | Ordered by `pos`, re-spaced 1024, 2048, …; archived → `archivedAt` (only with `includeArchived`, otherwise skipped with their cards). A Trello list named "Inbox" becomes the Inbox; otherwise a standard Inbox list is created first |
| Labels | Colours `green yellow orange red purple blue sky lime pink black` kept (`*_dark` / `*_light` folded to the base), `null`/unknown → `blue`; unnamed labels are named after the colour ("Green"); duplicates (same name + colour) merged |
| Cards | Order by `pos` within a list; `due`→`dueDate`, `start`→`startDate`, `dueComplete` → `completedAt` (= due, or now); `closed` → archived; `createdAt` from the Trello id timestamp; `source='board'`, creator = importer |
| Members on cards / checklist items | Mapped users only (assignees / `assigneeId`) |
| Checklists + items | Ordered by `pos`; `state='complete'` → `isDone`; empty items dropped |
| Comments (`commentCard` actions) | Mapped author → that user, text unchanged; otherwise author = importer and the body starts with `Originally by {name} on Trello · {YYYY-MM-DD HH:mm UTC}` (the portal shows that line as a caption). `createdAt` = original date |
| Attachments | `http(s)` URLs ≤ 500 chars → `Attachment` rows that **link** to the original URL (`size` = bytes or 0); others are listed under "Attachments (from Trello):" in the card description. Files are not downloaded |

Everything is written in one interactive transaction (60 s timeout) with chunked `createMany`, then one
`board.imported` activity (`data: { source: 'trello', name, counts }`) is logged. No socket events are emitted
(the board is new, so nobody is in its room yet).

## Limitations
- Trello's JSON export only includes the ~1000 most recent actions, so very old comments may be missing.
- Trello-hosted attachment links require being logged into Trello to download; they are not copied.
- Custom fields, Power-Ups, votes, stickers, card covers and board backgrounds are not imported.
