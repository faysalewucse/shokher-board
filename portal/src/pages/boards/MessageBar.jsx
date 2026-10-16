import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Avatar, Button, Mentions, Select, Tooltip, Skeleton, message as toast } from 'antd';
import {
  SendOutlined, UpOutlined, DownOutlined, MessageOutlined, CheckCircleFilled, QuestionCircleOutlined,
} from '@ant-design/icons';
import { getMessages, postMessage, errorMessage } from '@/services/boards';
import { useBoard } from './boardState';
import {
  avatarSrc, initials, fromNow, mentionToken, labelToken, formatDue,
} from './boardUtils';
import { LabelSwatch } from './BoardChips';

const PAGE = 30;
const STORAGE_KEY = 'shokherboard.messageThreadOpen';

const readOpen = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const SYNTAX_HELP = (
  <div style={{ fontSize: 12, lineHeight: 1.7 }}>
    <div><b>@name</b> assign a board member</div>
    <div><b>#label</b> add a label (created if missing)</div>
    <div><b>!today</b> · <b>!tomorrow</b> · <b>!fri</b> · <b>!2026-12-31</b> · <b>!25oct</b> set due date</div>
    <div>First line is the title; <b>Shift+Enter</b> for more lines (description).</div>
  </div>
);

/**
 * Chat-style message-to-card bar docked at the bottom of a board.
 * `messages` live here; the board passes realtime `message.created`
 * payloads through `incoming` (a { seq, message } object).
 */
export default function MessageBar({ boardId, incoming, onCreated, onOpenCard }) {
  const { state, canEdit } = useBoard();
  const { lists, members, labels, cards } = state;

  const inbox = lists.find((l) => l.isInbox) || lists[0];
  const [listId, setListId] = useState(null);
  const targetListId = lists.some((l) => l.id === listId) ? listId : inbox?.id;

  const [open, setOpen] = useState(readOpen);
  const [messages, setMessages] = useState([]); // newest first
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null); // meta.nextCursor (ISO date)
  const hasMore = !!cursor;
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [prefix, setPrefix] = useState('@');
  const threadRef = useRef(null);

  const addMessage = useCallback((msg) => {
    if (!msg?.id) return;
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    getMessages(boardId, { limit: PAGE })
      .then(({ data, meta }) => {
        if (cancelled) return;
        setMessages(data || []);
        setCursor(meta?.nextCursor || null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [boardId]);

  // Realtime messages from other people
  useEffect(() => {
    if (incoming?.message) addMessage(incoming.message);
  }, [incoming, addMessage]);

  // Keep the thread pinned to the newest message
  useEffect(() => {
    if (open && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [open, messages.length]);

  const toggleOpen = () => {
    setOpen((o) => {
      try { localStorage.setItem(STORAGE_KEY, o ? '0' : '1'); } catch { /* ignore */ }
      return !o;
    });
  };

  const loadOlder = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const el = threadRef.current;
    const prevHeight = el?.scrollHeight || 0;
    try {
      const { data, meta } = await getMessages(boardId, { before: cursor, limit: PAGE });
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.filter((m) => !seen.has(m.id))];
      });
      setCursor(meta?.nextCursor || null);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load messages'));
    } finally {
      setLoadingMore(false);
    }
  };

  const send = async () => {
    const value = text.trim();
    if (!value || sending || !canEdit) return;
    setSending(true);
    try {
      const msg = await postMessage(boardId, value, targetListId);
      setText('');
      addMessage(msg);
      if (msg?.card) onCreated?.(msg.card);
      if (!open) {
        const listName = lists.find((l) => l.id === (msg?.card?.listId || msg?.listId))?.name;
        toast.success(`Card created${listName ? ` in ${listName}` : ''}`);
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to send'));
    } finally {
      setSending(false);
    }
  };

  const options = useMemo(() => {
    if (prefix === '#') {
      return labels.map((l) => ({
        key: l.id,
        value: labelToken(l),
        label: (
          <span className="flex items-center gap-2">
            <LabelSwatch color={l.color} />
            {l.name}
          </span>
        ),
      }));
    }
    return members.map((m) => ({
      key: m.userId,
      value: mentionToken(m.user),
      label: (
        <span className="flex items-center gap-2">
          <Avatar size={18} src={avatarSrc(m.user)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 9 }}>
            {initials(m.user?.name)}
          </Avatar>
          {m.user?.name}
          <span className="mono text-[11px]" style={{ color: 'var(--c-fg-3)' }}>@{mentionToken(m.user)}</span>
        </span>
      ),
    }));
  }, [prefix, labels, members]);

  const cardsById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const thread = useMemo(() => messages.slice().reverse(), [messages]); // oldest → newest

  return (
    <div
      className="shrink-0 border-t bg-surface"
      style={{ borderColor: 'var(--c-fg)' }}
    >
      {/* Thread toggle */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[12px] text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <MessageOutlined />
        <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg">Messages</span>
        <span className="text-fg-3">
          {messages.length ? `${messages.length}${hasMore ? '+' : ''} recent` : 'Type a message to create a card'}
        </span>
        <span className="ml-auto">{open ? <DownOutlined /> : <UpOutlined />}</span>
      </button>

      {open && (
        <div ref={threadRef} className="max-h-[32vh] overflow-y-auto border-t border-line bg-surface-2 px-4 py-2">
          {loading ? (
            <div className="flex flex-col gap-3 py-2">
              {[0, 1].map((i) => <Skeleton key={i} active avatar={{ size: 28, shape: 'square' }} title={{ width: '30%' }} paragraph={{ rows: 1, width: '60%' }} />)}
            </div>
          ) : thread.length === 0 ? (
            <div className="py-3 text-center text-[12px] text-fg-3">No messages yet — type below to turn a message into a card.</div>
          ) : (
            <>
              {hasMore && (
                <div className="mb-2 text-center">
                  <Button size="small" type="link" loading={loadingMore} onClick={loadOlder}>Load older</Button>
                </div>
              )}
              {thread.map((m) => {
                const live = cardsById[m.id];
                const card = live || m.card;
                const listName = lists.find((l) => l.id === (card?.listId || m.listId))?.name;
                return (
                  <div
                    key={m.id}
                    onClick={() => onOpenCard(m.id)}
                    className="group flex cursor-pointer gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface"
                  >
                    <Avatar size={28} src={avatarSrc(m.author)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', flexShrink: 0, fontSize: 11 }}>
                      {initials(m.author?.name)}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-bold text-fg">{m.author?.name || 'Someone'}</span>
                        <Tooltip title={new Date(m.createdAt).toLocaleString()}>
                          <span className="mono text-[10.5px] text-fg-3">{fromNow(m.createdAt)}</span>
                        </Tooltip>
                      </div>
                      <div className="mt-0.5 inline-block max-w-full whitespace-pre-wrap break-words rounded-md rounded-tl-none border border-line bg-surface px-2.5 py-1.5 text-[13px] text-fg group-hover:border-line-2">
                        {m.text}
                        {m.description ? <div className="text-[12px] text-fg-2">{m.description}</div> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-2">
                        {live ? (
                          <>
                            {card.completedAt && <CheckCircleFilled style={{ color: 'var(--c-fg)' }} aria-label="Completed" />}
                            <span className="mono text-[10.5px] uppercase tracking-[0.08em]">→ {listName || 'card'}</span>
                            {card.dueDate && <span className="mono-tag mono-tag--soft" style={{ height: 18, fontSize: 10 }}>due {formatDue(card.dueDate)}</span>}
                            {card.assignees?.map((u) => (
                              <span key={u.id} className="mono-tag mono-tag--outline" style={{ height: 18, fontSize: 10 }}>@{u.name}</span>
                            ))}
                          </>
                        ) : (
                          <span className="italic line-through">card archived</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 px-3 pb-3 pt-1.5 sm:px-4">
        <Select
          size="middle"
          value={targetListId}
          onChange={setListId}
          disabled={!canEdit}
          options={lists.map((l) => ({ value: l.id, label: l.name }))}
          popupMatchSelectWidth={false}
          className="w-[104px] shrink-0 sm:w-[140px]"
          aria-label="Target list"
        />
        <div className="min-w-0 flex-1">
          <Mentions
            value={text}
            onChange={setText}
            prefix={['@', '#']}
            onSearch={(_, p) => setPrefix(p)}
            options={options}
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={!canEdit || sending}
            placement="top"
            placeholder={canEdit ? 'Message → card  (e.g. "Fix login bug @arafat #bug !fri")' : 'View-only: you can’t create cards on this board'}
            // onPressEnter only fires when the @/# dropdown is closed, so Enter
            // still picks a suggestion while it is open.
            onPressEnter={(e) => {
              if (e.shiftKey || e.nativeEvent?.isComposing) return;
              e.preventDefault();
              send();
            }}
          />
          <div className="mono mt-1 hidden truncate text-[10.5px] text-fg-3 sm:block">
            <b>@</b>member · <b>#</b>label · <b>!</b>tomorrow / !fri / !25oct · Enter to send, Shift+Enter for new line
          </div>
        </div>
        <Tooltip title={SYNTAX_HELP} placement="topRight">
          <QuestionCircleOutlined className="mb-2 text-fg-3 sm:hidden" />
        </Tooltip>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          disabled={!canEdit || !text.trim()}
          onClick={send}
          aria-label="Send message"
          className="sm:mb-[22px]"
        />
      </div>
    </div>
  );
}
