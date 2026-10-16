# Boards (implementation notes)

The API contract is [boards-contract.md](boards-contract.md). This page covers the server-side details the contract leaves open.

## Code map

| Concern | File |
|---------|------|
| Models | `prisma/schema/{client,project,board,card,activity}.prisma` (migration `20261005120000_boards`) |
| Board access (`getBoardRole`, `assertBoardRole(min, kind)`) | `src/services/boardAccess.js` |
| Response shapes (UserLite, CardSummary, ...) | `src/services/boardFormat.js` |
| Fractional positions + rebalance | `src/services/positionService.js` |
| Message parsing (pure) | `src/services/messageParser.js` (self-test: `npm run test:parser`) |
| Activity feed | `src/services/activityService.js` |
| Notifications (`card.assigned`, `card.mentioned`, `card.due_soon`) | `src/services/boardNotify.js`, `src/services/dueSoonService.js` |
| Realtime (`board:join`, `board:leave`, `emitToBoard`) | `src/lib/socket.js` |
| Routes | `src/routes/{client,project,board,list,card,label,checklist,comment,attachment}Routes.js`, `GET /users/lookup` in `userRoutes.js` |

## Access

- `assertBoardRole(min, kind)` resolves the board from the route's `:id`, which can be a board, list, card, label, checklist, checklist item, comment or attachment. It returns 404 when the entity doesn't exist and 403 when the caller isn't a member or their role is too low. On success it sets `req.board = { id, projectId, role }`.
- Users with `BOARD_MANAGE_ANY` are treated as `owner` on every board. Their `myRole` is therefore `'owner'`, not `null`.
- Comments: `PATCH` is author-only. `DELETE` is allowed for the author or a board owner. Both also require at least the `member` role.

## Behaviour details

- **Archiving.** `DELETE` on clients, projects, boards, lists and cards sets `archivedAt` rather than deleting the row. Archiving a list also archives its active cards. Checklists, checklist items, comments, attachments and labels are hard-deleted. Deleting an attachment also removes its file.
- **Positions.** New lists, cards, checklists and checklist items without a position go to the end, at the last position + 1024. After a create or move that sets an explicit position, the server checks the neighbouring gaps. If either gap is below 0.001, it re-spaces the whole scope to 1024, 2048, … and emits `lists.reordered` or `cards.reordered`. Cards are scoped by list and lists by board.
- **Messages.** `POST /boards/:id/messages` emits `message.created` only, not `card.created`. Its payload is a `Message`, and `payload.card` holds the `CardSummary`. Any labels created from `#tokens` also emit `label.created`. `GET /boards/:id/messages` returns `meta.nextCursor`, which is an ISO timestamp. Pass it as `before`. `before` also accepts a card id.
- **Token rules.**
  - A token must start the line or follow whitespace, so `bob@x.com` and `issue#4` are not tokens.
  - `!mon`…`!sun` means the next such day, strictly after today. Full weekday names also work.
  - `!25oct` rolls over to next year if that date has already passed.
  - If the first line contains only tokens, the raw line is kept as the title.
- **Comments order.** `GET /cards/:id/comments` returns comments newest first.
- **Activity pagination.** `GET /boards/:id/activity` and `GET /cards/:id/activity` take `cursor` and `limit` (default 30, max 100) and return `meta.nextCursor`, which is an activity id.
- **Event payload details.**
  - `board.updated` omits `myRole`, because that value is different for each viewer.
  - `member.removed` sends `{ id: userId, userId }`, and the removed user's sockets are taken out of the board room.
  - `comment.deleted` sends `{ id, cardId }`.
  - `attachment.changed` sends `{ ...Attachment, cardId, card: CardSummary }` on upload and `{ id, deleted: true, cardId, card }` on delete.
- **Attachments.** Uploads use the multipart field `file`, are limited to 20MB and are stored in `uploads/attachments/`. Executable or browser-active types are rejected: html, svg, js and similar. `utils/fileCleanup` never scans this folder.
- **Due-soon job.** It runs hourly (`0 * * * *`) in every environment and is started from `server.js`. It claims each card by setting `dueNotifiedAt` before it notifies anyone. Changing a card's `dueDate` resets `dueNotifiedAt`.
- **Audit log.** The global audit middleware also logs `/clients` and `/projects`. Board, list and card history is kept in `Activity`.
