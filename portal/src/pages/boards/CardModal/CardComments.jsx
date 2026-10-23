import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Mentions, Popconfirm, Skeleton, Tooltip, message } from 'antd';
import { getComments, createComment, updateComment, deleteComment, errorMessage } from '@/services/boards';
import { avatarSrc, initials, fromNow, mentionToken } from '../boardUtils';

// First line the Trello importer adds when the original author wasn't mapped.
const IMPORTED_RE = /^(Originally by .+ on Trello · [^\n]+)\n\n/;

/** Render a comment body, highlighting @mentions (imported attribution shown as a caption). */
function Body({ text }) {
  const raw = String(text || '');
  const imported = raw.match(IMPORTED_RE);
  const parts = (imported ? raw.slice(imported[0].length) : raw).split(/(@[\w.-]+)/g);
  return (
    <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg">
      {imported && <div className="mono mb-1 text-[10.5px] text-fg-3">{imported[1]}</div>}
      {parts.map((p, i) => (p.startsWith('@')
        ? <span key={i} className="mention">{p}</span>
        : <span key={i}>{p}</span>))}
    </div>
  );
}

function MentionBox({ value, onChange, options, onSubmit, placeholder, autoFocus }) {
  return (
    <Mentions
      value={value}
      onChange={onChange}
      options={options}
      prefix="@"
      autoFocus={autoFocus}
      autoSize={{ minRows: 2, maxRows: 8 }}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}

/**
 * Comments list + composer. `refreshKey` changes when a realtime comment
 * event arrives for this card; `onCountChange(n)` keeps the tile badge right.
 */
export default function CardComments({ cardId, members, me, canEdit, isOwner, refreshKey, onCountChange }) {
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(null); // { id, body }

  useEffect(() => {
    let cancelled = false;
    getComments(cardId)
      .then((data) => {
        if (cancelled) return;
        setComments(data || []);
        onCountChange?.((data || []).length);
      })
      .catch(() => !cancelled && setComments((prev) => prev || []));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on card or realtime signal only
  }, [cardId, refreshKey]);

  const options = useMemo(() => members.map((m) => ({
    key: m.userId,
    value: mentionToken(m.user),
    label: (
      <span className="flex items-center gap-2">
        <Avatar size={18} src={avatarSrc(m.user)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 9 }}>{initials(m.user?.name)}</Avatar>
        {m.user?.name}
      </span>
    ),
  })), [members]);

  const setAndCount = (next) => {
    setComments(next);
    onCountChange?.(next.length);
  };

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const c = await createComment(cardId, body);
      setDraft('');
      setAndCount([c, ...(comments || []).filter((x) => x.id !== c.id)]);
    } catch (err) {
      message.error(errorMessage(err, 'Failed to post comment'));
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async () => {
    const body = editing.body.trim();
    if (!body) return;
    const prev = comments;
    setComments(comments.map((c) => (c.id === editing.id ? { ...c, body, editedAt: new Date().toISOString() } : c)));
    setEditing(null);
    try {
      const updated = await updateComment(editing.id, body);
      if (updated?.id) setComments((cs) => cs.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    } catch (err) {
      setComments(prev);
      message.error(errorMessage(err, 'Failed to edit comment'));
    }
  };

  const remove = async (c) => {
    try {
      await deleteComment(c.id);
      setAndCount(comments.filter((x) => x.id !== c.id));
    } catch (err) {
      message.error(errorMessage(err, 'Failed to delete comment'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex gap-2.5">
          <Avatar size={30} src={avatarSrc(me)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', flexShrink: 0 }}>{initials(me?.name)}</Avatar>
          <div className="flex-1">
            <MentionBox
              value={draft}
              onChange={setDraft}
              options={options}
              onSubmit={post}
              placeholder="Write a comment… use @name to mention (Ctrl/⌘+Enter to send)"
            />
            {draft.trim() && (
              <Button type="primary" size="small" className="mt-2" loading={posting} onClick={post}>Save</Button>
            )}
          </div>
        </div>
      )}

      {comments === null ? (
        <Skeleton active avatar={{ size: 30 }} title={{ width: '30%' }} paragraph={{ rows: 1 }} />
      ) : comments.length === 0 ? (
        <div className="text-[12px] text-fg-3">No comments yet.</div>
      ) : (
        comments.map((c) => {
          const mine = c.author?.id === me?.id;
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar size={30} src={avatarSrc(c.author)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', flexShrink: 0 }}>{initials(c.author?.name)}</Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-bold">{c.author?.name}</span>
                  <Tooltip title={new Date(c.createdAt).toLocaleString()}>
                    <span className="mono text-[10.5px] text-fg-3">{fromNow(c.createdAt)}</span>
                  </Tooltip>
                  {c.editedAt && <span className="text-[11px] italic text-fg-3">(edited)</span>}
                </div>
                {editing?.id === c.id ? (
                  <div>
                    <MentionBox
                      autoFocus
                      value={editing.body}
                      onChange={(body) => setEditing({ ...editing, body })}
                      options={options}
                      onSubmit={saveEdit}
                    />
                    <div className="mt-1 flex gap-2">
                      <Button size="small" type="primary" onClick={saveEdit}>Save</Button>
                      <Button size="small" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 rounded-md rounded-tl-none border border-line bg-surface-2 px-3 py-2"><Body text={c.body} /></div>
                )}
                {editing?.id !== c.id && (mine || isOwner) && (
                  <div className="mt-0.5 flex gap-2 text-[11px]">
                    {mine && (
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-fg-2 underline underline-offset-2 hover:text-fg" onClick={() => setEditing({ id: c.id, body: c.body })}>
                        Edit
                      </button>
                    )}
                    <Popconfirm title="Delete this comment?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(c)}>
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-fg-2 underline underline-offset-2 hover:text-fg">Delete</button>
                    </Popconfirm>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
