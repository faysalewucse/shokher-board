import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { Button, Result, Skeleton, message } from 'antd';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, closestCorners, pointerWithin, MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable';
import { useAuth } from '@/context/AuthContext';
import {
  getBoard, createList, updateList, deleteList, createCard, moveCard, errorMessage,
} from '@/services/boards';
import { BoardContext, boardReducer, initialBoardState } from './boardState';
import { byPosition, positionAtEnd, positionForOrderedIds } from './positions';
import { LIST_WIDTH, listDndId } from './dndIds';
import { boardSurfaceClass, DEFAULT_BOARD_COLOR } from './boardUtils';
import { MonoArt } from '@/components/MonoEmpty';
import useBoardSocket from './useBoardSocket';
import BoardHeader from './BoardHeader';
import ListColumn from './ListColumn';
import { CardTile } from './CardTile';
import InlineComposer from './InlineComposer';
import MessageBar from './MessageBar';
import ActivityDrawer from './ActivityDrawer';
import CardModal from './CardModal';

/** Static (non-sortable) copy of a list for the drag overlay. */
function ListPreview({ list, cards, labelsById }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-md p-2"
      style={{
        width: LIST_WIDTH,
        background: 'var(--c-surface-3)',
        border: '1px solid var(--c-fg)',
        transform: 'rotate(2deg)',
        boxShadow: 'var(--shadow-hard-lg)',
        cursor: 'grabbing',
      }}
    >
      <div className="px-1 pb-1 font-display text-[13px] font-bold tracking-tight text-fg">{list.name}</div>
      {cards.slice(0, 6).map((c) => <CardTile key={c.id} card={c} labelsById={labelsById} />)}
      {cards.length > 6 && <div className="mono px-1 text-[11px] text-fg-3">+{cards.length - 6} more</div>}
    </div>
  );
}

const listIdOfDnd = (id) => String(id).replace(/^(list|drop):/, '');

// Custom collisions: lists only collide with lists; cards prefer the card
// under the pointer, then the list body under it, then the closest card.
function collisionDetection(args) {
  const type = args.active.data.current?.type;
  if (type === 'list') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'list'),
    });
  }
  const containers = args.droppableContainers.filter((c) => c.data.current?.type !== 'list');
  const hits = pointerWithin({ ...args, droppableContainers: containers });
  if (hits.length) {
    const cardHit = hits.find((h) => h.data?.droppableContainer?.data.current?.type === 'card');
    return [cardHit || hits[0]];
  }
  return closestCorners({ ...args, droppableContainers: containers });
}

function BoardPage({ boardId }) {
  const navigate = useNavigate();
  const { user, permissions } = useAuth();
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [cardSignal, setCardSignal] = useState(null); // detail changed → refetch card
  const [commentSignal, setCommentSignal] = useState(null); // comments changed → refetch comments
  const [searchParams, setSearchParams] = useSearchParams();
  const openCardId = searchParams.get('card');

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getBoard(boardId)
      .then((data) => !cancelled && dispatch({ type: 'load', data }))
      .catch((err) => !cancelled && setLoadError({ status: err?.response?.status, message: errorMessage(err, 'Failed to load board') }))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [boardId]);

  // ── Roles ─────────────────────────────────────────────────────────────
  const manageAny = permissions.includes('BOARD_MANAGE_ANY');
  const myRole = state.board?.myRole;
  const isOwner = myRole === 'owner' || manageAny;
  const canEdit = isOwner || myRole === 'member';

  // ── Card modal via ?card=<id> ─────────────────────────────────────────
  const openCard = useCallback((cardId) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('card', cardId);
      return p;
    });
  }, [setSearchParams]);
  const closeCard = useCallback(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('card');
      return p;
    });
  }, [setSearchParams]);

  // ── Realtime ──────────────────────────────────────────────────────────
  const signalCard = (cardId, type) => {
    if (openCardId && (!cardId || cardId === openCardId)) {
      const sig = { cardId, at: Date.now() };
      if (type === 'comments') setCommentSignal(sig);
      else setCardSignal(sig);
    }
  };
  const upsertCard = (card) => card?.id && dispatch({ type: 'card/upsert', card });

  const { connected } = useBoardSocket(boardId, {
    'board.updated': (board) => dispatch({ type: 'board/patch', patch: { ...board, myRole: state.board?.myRole } }),
    'board.deleted': () => {
      message.warning('This board was archived');
      navigate('/boards');
    },
    'member.added': (m) => dispatch({ type: 'member/upsert', member: m }),
    'member.updated': (m) => {
      dispatch({ type: 'member/upsert', member: m });
      if (m.userId === user?.id) dispatch({ type: 'board/patch', patch: { myRole: m.role } });
    },
    'member.removed': (p) => {
      const userId = p?.userId || p?.id;
      dispatch({ type: 'member/remove', userId });
      if (userId === user?.id && !manageAny) {
        message.warning('You were removed from this board');
        navigate('/boards');
      }
    },
    'label.created': (l) => dispatch({ type: 'label/upsert', label: l }),
    'label.updated': (l) => dispatch({ type: 'label/upsert', label: l }),
    'label.deleted': ({ id }) => dispatch({ type: 'label/remove', id }),
    'list.created': (l) => dispatch({ type: 'list/upsert', list: l }),
    'list.updated': (l) => dispatch({ type: 'list/upsert', list: l }),
    'list.deleted': ({ id }) => dispatch({ type: 'list/remove', id }),
    'lists.reordered': ({ items = [] }) => dispatch({ type: 'lists/reorder', items }),
    'card.created': upsertCard,
    'card.updated': (c) => { upsertCard(c); signalCard(c?.id, 'card'); },
    'card.moved': (c) => { upsertCard(c); signalCard(c?.id, 'card'); },
    'card.deleted': ({ id }) => {
      dispatch({ type: 'card/remove', id });
      if (id === openCardId) {
        message.info('This card was archived');
        closeCard();
      }
    },
    'cards.reordered': ({ items = [] }) => dispatch({ type: 'cards/reorder', items }),
    'message.created': (msg) => {
      if (msg?.card) upsertCard(msg.card);
      setIncomingMessage({ message: msg, at: Date.now() });
    },
    'comment.created': (c) => {
      if (c?.cardId) dispatch({ type: 'card/counts', id: c.cardId, counts: (k) => ({ comments: (k.comments || 0) + 1 }) });
      signalCard(c?.cardId, 'comments');
    },
    'comment.updated': (c) => signalCard(c?.cardId, 'comments'),
    'comment.deleted': (c) => {
      if (c?.cardId) dispatch({ type: 'card/counts', id: c.cardId, counts: (k) => ({ comments: Math.max(0, (k.comments || 0) - 1) }) });
      signalCard(c?.cardId, 'comments');
    },
    'checklist.changed': (c) => { upsertCard(c); signalCard(c?.id, 'card'); },
    'attachment.changed': (p) => {
      // Payload: { ...Attachment | { id, deleted }, cardId, card: CardSummary }
      if (p?.card) upsertCard(p.card);
      signalCard(p?.cardId, 'card');
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────
  const labelsById = useMemo(() => Object.fromEntries(state.labels.map((l) => [l.id, l])), [state.labels]);
  const cardsById = useMemo(() => Object.fromEntries(state.cards.map((c) => [c.id, c])), [state.cards]);
  const derivedColumns = useMemo(() => {
    const cols = Object.fromEntries(state.lists.map((l) => [l.id, []]));
    state.cards.slice().sort(byPosition).forEach((c) => cols[c.listId]?.push(c.id));
    return cols;
  }, [state.lists, state.cards]);

  // ── Drag & drop ───────────────────────────────────────────────────────
  const [dragColumns, setDragColumns] = useState(null); // working copy while dragging a card
  const [activeDrag, setActiveDrag] = useState(null); // { type: 'card'|'list', id }
  const columns = dragColumns || derivedColumns;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id, cols) => Object.keys(cols).find((k) => cols[k].includes(id));
  const overContainer = (over, cols) => {
    const t = over?.data.current?.type;
    if (t === 'card') return findContainer(over.id, cols);
    if (t === 'list' || t === 'list-drop') return over.data.current.listId;
    return null;
  };

  const onDragStart = ({ active }) => {
    const type = active.data.current?.type;
    if (type === 'card') {
      setDragColumns(Object.fromEntries(Object.entries(derivedColumns).map(([k, v]) => [k, v.slice()])));
      setActiveDrag({ type: 'card', id: active.id });
    } else if (type === 'list') {
      setActiveDrag({ type: 'list', id: listIdOfDnd(active.id) });
    }
  };

  const onDragOver = ({ active, over }) => {
    if (active.data.current?.type !== 'card' || !over) return;
    setDragColumns((cols) => {
      if (!cols) return cols;
      const from = findContainer(active.id, cols);
      const to = overContainer(over, cols);
      if (!from || !to || from === to) return cols;
      const fromItems = cols[from].filter((id) => id !== active.id);
      const toItems = (cols[to] || []).slice();
      let index = toItems.length;
      if (over.data.current?.type === 'card') {
        const overIndex = toItems.indexOf(over.id);
        const r = active.rect.current.translated;
        const below = r && r.top > over.rect.top + over.rect.height / 2;
        if (overIndex >= 0) index = overIndex + (below ? 1 : 0);
      }
      toItems.splice(index, 0, active.id);
      return { ...cols, [from]: fromItems, [to]: toItems };
    });
  };

  const persistCardMove = async (card, listId, position) => {
    const prev = { listId: card.listId, position: card.position };
    dispatch({ type: 'card/patch', id: card.id, patch: { listId, position } });
    try {
      const updated = await moveCard(card.id, listId, position);
      if (updated?.id) dispatch({ type: 'card/upsert', card: updated });
    } catch (err) {
      dispatch({ type: 'card/patch', id: card.id, patch: prev });
      message.error(errorMessage(err, 'Could not move card'));
    }
  };

  const persistListMove = async (list, position) => {
    const prevPosition = list.position;
    dispatch({ type: 'list/upsert', list: { ...list, position } });
    try {
      await updateList(list.id, { position });
    } catch (err) {
      dispatch({ type: 'list/upsert', list: { ...list, position: prevPosition } });
      message.error(errorMessage(err, 'Could not move list'));
    }
  };

  const onDragEnd = ({ active, over }) => {
    const type = active.data.current?.type;
    const cols = dragColumns;
    setDragColumns(null);
    setActiveDrag(null);
    if (!over) return;

    if (type === 'card' && cols) {
      const card = cardsById[active.id];
      const listId = findContainer(active.id, cols);
      if (!card || !listId) return;
      let ids = cols[listId].filter((id) => id === active.id || cardsById[id]);
      if (over.data.current?.type === 'card' && over.id !== active.id && findContainer(over.id, cols) === listId) {
        const oldIndex = ids.indexOf(active.id);
        const newIndex = ids.indexOf(over.id);
        if (oldIndex !== -1 && newIndex !== -1) ids = arrayMove(ids, oldIndex, newIndex);
      }
      const unchanged = card.listId === listId && (derivedColumns[listId] || []).join() === ids.join();
      if (unchanged) return;
      const position = positionForOrderedIds(ids, active.id, (id) => cardsById[id]?.position);
      persistCardMove(card, listId, position);
      return;
    }

    if (type === 'list' && over.data.current?.type === 'list') {
      const fromId = listIdOfDnd(active.id);
      const toId = listIdOfDnd(over.id);
      if (fromId === toId) return;
      const ids = state.lists.map((l) => l.id);
      const ordered = arrayMove(ids, ids.indexOf(fromId), ids.indexOf(toId));
      const listsById = Object.fromEntries(state.lists.map((l) => [l.id, l]));
      persistListMove(listsById[fromId], positionForOrderedIds(ordered, fromId, (id) => listsById[id].position));
    }
  };

  const onDragCancel = () => {
    setDragColumns(null);
    setActiveDrag(null);
  };

  // ── Lists & cards CRUD ────────────────────────────────────────────────
  const addList = async (name) => {
    try {
      const list = await createList(boardId, { name, position: positionAtEnd(state.lists) });
      if (list?.id) dispatch({ type: 'list/upsert', list });
    } catch (err) {
      message.error(errorMessage(err, 'Failed to add list'));
      throw err;
    }
  };

  const renameList = async (listId, name) => {
    const list = state.lists.find((l) => l.id === listId);
    dispatch({ type: 'list/upsert', list: { ...list, name } });
    try {
      await updateList(listId, { name });
    } catch (err) {
      dispatch({ type: 'list/upsert', list });
      message.error(errorMessage(err, 'Failed to rename list'));
    }
  };

  const archiveList = async (listId) => {
    try {
      await deleteList(listId);
      dispatch({ type: 'list/remove', id: listId });
    } catch (err) {
      message.error(errorMessage(err, 'Failed to archive list'));
    }
  };

  const addCard = async (listId, title) => {
    try {
      const position = positionAtEnd(state.cards.filter((c) => c.listId === listId));
      const card = await createCard(boardId, { listId, title, position });
      if (card?.id) dispatch({ type: 'card/upsert', card });
    } catch (err) {
      message.error(errorMessage(err, 'Failed to add card'));
      throw err;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  const boardColor = state.board?.color || DEFAULT_BOARD_COLOR;
  const ctx = useMemo(() => ({
    state, dispatch, boardId, isOwner, canEdit, openCard, boardColor,
  }), [state, boardId, isOwner, canEdit, openCard, boardColor]);

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-3 p-1">
        <Skeleton.Input active size="large" style={{ width: 280 }} />
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel flex flex-col gap-2 p-2" style={{ width: LIST_WIDTH }}>
              <Skeleton active title={{ width: '50%' }} paragraph={false} />
              {[0, 1, 2].slice(0, 3 - (i % 2)).map((j) => <Skeleton.Node key={j} active style={{ width: LIST_WIDTH - 18, height: 58 }} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (loadError || !state.board) {
    const status = loadError?.status;
    return (
      <Result
        status={status === 403 ? 'warning' : 'error'}
        icon={<MonoArt kind={status === 403 ? '403' : status === 404 ? '404' : 'error'} />}
        title={status === 403 ? 'No access' : status === 404 ? 'Board not found' : 'Could not load board'}
        subTitle={loadError?.message}
        extra={<Link to="/boards"><Button type="primary">Back to boards</Button></Link>}
      />
    );
  }

  const activeCard = activeDrag?.type === 'card' ? cardsById[activeDrag.id] : null;
  const activeList = activeDrag?.type === 'list' ? state.lists.find((l) => l.id === activeDrag.id) : null;
  const cardsFor = (listId) => (columns[listId] || []).map((id) => cardsById[id]).filter(Boolean);

  return (
    <BoardContext.Provider value={ctx}>
      <div
        className={`-m-6 flex flex-col ${boardSurfaceClass(boardColor)}`}
        style={{ height: 'calc(100% + 48px)' }}
      >
        <BoardHeader connected={connected} onOpenActivity={() => setActivityOpen(true)} />

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full items-start gap-3 p-3 sm:p-4" style={{ width: 'max-content' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext items={state.lists.map((l) => listDndId(l.id))} strategy={horizontalListSortingStrategy}>
                {state.lists.map((list) => (
                  <ListColumn
                    key={list.id}
                    list={list}
                    cards={cardsFor(list.id)}
                    labelsById={labelsById}
                    canEdit={canEdit}
                    onOpenCard={openCard}
                    onAddCard={addCard}
                    onRenameList={renameList}
                    onArchiveList={archiveList}
                  />
                ))}
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 160 }}>
                {activeCard ? <CardTile card={activeCard} labelsById={labelsById} overlay /> : null}
                {activeList ? <ListPreview list={activeList} cards={cardsFor(activeList.id)} labelsById={labelsById} /> : null}
              </DragOverlay>
            </DndContext>

            {canEdit && (
              <div className="shrink-0" style={{ width: LIST_WIDTH }}>
                <InlineComposer
                  variant="list"
                  triggerLabel={state.lists.length ? 'Add another list' : 'Add a list'}
                  placeholder="Enter list name…"
                  submitLabel="Add list"
                  onSubmit={addList}
                />
              </div>
            )}
          </div>
        </div>

        <MessageBar
          boardId={boardId}
          incoming={incomingMessage}
          onCreated={(card) => dispatch({ type: 'card/upsert', card })}
          onOpenCard={openCard}
        />
      </div>

      {openCardId && (
        <CardModal
          key={openCardId}
          cardId={openCardId}
          onClose={closeCard}
          signal={cardSignal}
          commentSignal={commentSignal}
        />
      )}
      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} boardId={boardId} />
    </BoardContext.Provider>
  );
}

/** Route element for /boards/:id — keyed so switching boards resets state. */
export default function Board() {
  const { id } = useParams();
  return <BoardPage key={id} boardId={id} />;
}
