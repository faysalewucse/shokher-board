# Boards API contract (v1)

Shared spec for the server and portal. All routes sit under `/api/v1`, need `Authorization: Bearer <token>`, and use the standard envelope `{ success, message, data, meta? }`. IDs are cuid strings and dates are ISO strings.

## Domain

```
Client ─► Project ─► Board ─► List ─► Card
```
- A Board's `projectId` is **optional**, so standalone internal boards are allowed. A Project's `clientId` is also **optional**.
- Board access goes through `BoardMember` (role `owner | member | viewer`). A user with permission `BOARD_MANAGE_ANY` can see and manage every board.
  - Viewers have read-only access. Members can edit lists and cards. Owners can also edit the board itself, its members and its labels, and delete it.
- `position` is a Float (fractional ordering). The client sends the new position, computed as the midpoint of its neighbours, or neighbour ± 1024 at either end. When the gap between neighbours drops below 0.001, the server re-spaces that list or board and emits `lists:reordered` or `cards:reordered`.
- Every board gets a list named "Inbox" with `isInbox = true`, created along with the board. Message-cards land there by default.

## Permissions (new keys)
`CLIENT_READ`, `CLIENT_MANAGE`, `PROJECT_READ`, `PROJECT_MANAGE`, `BOARD_CREATE`, `BOARD_MANAGE_ANY`.
The admin role gets all of them. The default `user` role gets `CLIENT_READ`, `PROJECT_READ` and `BOARD_CREATE`.

## Shapes

```ts
UserLite   = { id, name, email, avatar }
Client     = { id, name, company, email, phone, notes, archivedAt, createdAt, updatedAt, projectCount? }
Project    = { id, name, description, clientId, client?: {id,name}, status: 'planning'|'active'|'on_hold'|'done',
               startDate, deadline, ownerId, owner?: UserLite, archivedAt, createdAt, updatedAt,
               boardCount?, progress?: { total, done } }          // done = cards with completedAt
Board      = { id, name, description, color, projectId, project?: {id,name,client?:{id,name}},
               archivedAt, createdAt, updatedAt, myRole: 'owner'|'member'|'viewer'|null }
BoardMember= { userId, role, user: UserLite }
Label      = { id, boardId, name, color }
List       = { id, boardId, name, position, isInbox, archivedAt }
CardSummary= { id, boardId, listId, title, position, dueDate, startDate, priority: null|'low'|'medium'|'high'|'urgent',
               completedAt, source: 'board'|'message', createdById, createdAt, updatedAt,
               assignees: UserLite[], labelIds: string[],
               counts: { comments, attachments, checklistItems, checklistDone } , hasDescription: boolean }
CardDetail = CardSummary & { description, createdBy: UserLite, archivedAt,
               checklists: [{ id, title, position, items: [{ id, text, isDone, position, assigneeId, dueDate }] }],
               attachments: [{ id, fileName, url, mimeType, size, uploader: UserLite, createdAt }] }
Comment    = { id, cardId, body, author: UserLite, createdAt, editedAt }
Activity   = { id, boardId, cardId, projectId, type, data, actor: UserLite, createdAt }
Message    = { id: cardId, text: card.title, description, listId, author: UserLite, createdAt, card: CardSummary }
```

## Endpoints

**Users**
- `GET /users/lookup?q=&limit=20`: any logged-in user can call this. It returns `UserLite[]` of active users, for assignee and member pickers.

**Clients:** `GET /clients?q=&archived=false` (CLIENT_READ) · `POST /clients` · `GET /clients/:id` (includes `projects`) · `PATCH /clients/:id` · `DELETE /clients/:id` (archives the client; CLIENT_MANAGE for writes)

**Projects:** `GET /projects?clientId=&status=&q=` (PROJECT_READ; includes boardCount and progress) · `POST /projects` · `GET /projects/:id` (includes `boards` the caller can see, plus progress) · `PATCH /projects/:id` · `DELETE /projects/:id` (archives; PROJECT_MANAGE)

**Boards**
- `GET /boards?projectId=&standalone=true`: boards the caller belongs to. With BOARD_MANAGE_ANY, all boards.
- `POST /boards { name, description?, color?, projectId? }` (BOARD_CREATE): the creator becomes owner, and the Inbox list is created.
- `POST /boards/import/trello` (BOARD_CREATE): creates a board from a normalized Trello export and returns `{ board, counts }`. See [trello-import.md](trello-import.md).
- `GET /boards/:id`: returns `{ board, members: BoardMember[], labels: Label[], lists: List[], cards: CardSummary[] }`, active items only, sorted by position.
- `PATCH /boards/:id` (owner) · `DELETE /boards/:id` (owner; archives the board)
- `POST /boards/:id/members { userId, role }` · `PATCH /boards/:id/members/:userId { role }` · `DELETE /boards/:id/members/:userId` (owner only; the last owner can't be removed)
- `POST /boards/:id/labels { name, color }` · `PATCH /labels/:id` · `DELETE /labels/:id` (owner)
- `GET /boards/:id/activity?cursor=&limit=30` returns `Activity[]` with `meta.nextCursor`.

**Lists** (members)
- `POST /boards/:id/lists { name, position? }` (defaults to the end)
- `PATCH /lists/:id { name?, position? }`
- `DELETE /lists/:id` archives the list and its cards. The Inbox list can't be deleted.

**Cards** (members)
- `POST /boards/:id/cards { listId, title, description?, position?, dueDate?, priority?, assigneeIds?, labelIds? }` returns `CardSummary`
- `GET /cards/:id` returns `CardDetail`
- `PATCH /cards/:id { title?, description?, dueDate?, startDate?, priority?, completed?: boolean }`
- `PATCH /cards/:id/move { listId, position }`
- `DELETE /cards/:id` archives the card.
- `PUT /cards/:id/assignees { userIds }`: they must be board members. Newly assigned users get a notification.
- `PUT /cards/:id/labels { labelIds }`
- `GET /cards/:id/activity`
- **Checklists:** `POST /cards/:id/checklists { title }` · `PATCH /checklists/:id { title?, position? }` · `DELETE /checklists/:id` · `POST /checklists/:id/items { text }` · `PATCH /checklist-items/:id { text?, isDone?, position?, assigneeId?, dueDate? }` · `DELETE /checklist-items/:id`
- **Comments:** `GET /cards/:id/comments` · `POST /cards/:id/comments { body }` (`@Name` mentions of board members send a notification) · `PATCH /comments/:id` · `DELETE /comments/:id` (author only, or the board owner)
- **Attachments:** `POST /cards/:id/attachments` (multipart field `file`, up to 20MB, stored under `uploads/attachments/`) · `DELETE /attachments/:id`

**Messages (message-to-card bar)**
- `GET /boards/:id/messages?before=&limit=30` returns `Message[]`: cards with `source='message'`, newest first, including archived ones.
- `POST /boards/:id/messages { text, listId? }` creates a card with `source='message'` and returns `Message`. The server parses `text`:
  - The first line, with tokens stripped, becomes the title. Any remaining lines become the description.
  - `@token` assigns the board member whose name (spaces removed, case-insensitive) or email local-part matches.
  - `#token` adds the board label whose name matches, case-insensitive. It's created with color `blue` if it's missing.
  - `!today`, `!tomorrow`, `!mon`…`!sun` (the next such day), `!YYYY-MM-DD` and `!25oct` or `!25-oct` set the due date (end of that day, server time).
  - Unmatched tokens stay in the title as typed.

## Realtime (socket.io)
- The client emits `board:join { boardId }`, with an ack `{ ok, error? }`; the server checks membership. It emits `board:leave { boardId }` when leaving. The room is `board:<id>`.
- The server emits `board:event { boardId, type, payload, actorId }` to the room after every mutation:
  - `type` values: `board.updated`, `board.deleted`, `member.added`, `member.updated`, `member.removed`, `label.created`, `label.updated`, `label.deleted`, `list.created`, `list.updated`, `list.deleted`, `lists.reordered`, `card.created`, `card.updated`, `card.moved`, `card.deleted`, `cards.reordered`, `message.created`, `comment.created`, `comment.updated`, `comment.deleted`, `checklist.changed`, `attachment.changed`.
  - `payload` is the new entity in the shapes above. Deletions send `{ id }`. `card.updated`, `card.moved` and `checklist.changed` send the full `CardSummary`. `lists.reordered` and `cards.reordered` send `{ items: [{id, position, listId?}] }`.
- Clients ignore events whose `actorId` is their own, because they've already applied the change optimistically.
- Notifications reuse the existing Notification model and its live push. The types are `card.assigned`, `card.mentioned` and `card.due_soon`, and `data` is `{ boardId, cardId }`, with `actionUrl` = `/boards/<boardId>?card=<cardId>`.
- Due-soon: an hourly cron job notifies assignees of cards due within 24 hours that aren't completed and haven't been notified yet (flag `dueNotifiedAt`).

## Activity types
`card.created`, `card.moved` (`data: {fromListId, toListId}`), `card.updated` (`data: {fields}`), `card.completed`, `card.reopened`, `card.assigned` (`data: {userId}`), `card.unassigned`, `card.archived`, `comment.created`, `attachment.added`, `checklist.item_done`, `list.created`, `list.archived`, `board.created`, `board.imported` (`data: {source, name, counts}`), `member.added`, `member.removed`, `project.created`, `project.status_changed`, `client.created`.
