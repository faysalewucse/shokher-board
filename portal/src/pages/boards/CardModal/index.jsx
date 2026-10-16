import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar, Button, DatePicker, Input, Modal, Popconfirm, Result, Select, Skeleton, Tabs, Tooltip, message,
} from 'antd';
import {
  AlignLeftOutlined, CheckOutlined, CheckSquareOutlined, CommentOutlined, DeleteOutlined,
  MessageOutlined, PaperClipOutlined, UndoOutlined, CreditCardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import {
  getCard, updateCard, moveCard, deleteCard, setCardAssignees, setCardLabels, getCardActivity, errorMessage,
} from '@/services/boards';
import { useBoard } from '../boardState';
import { positionAtEnd } from '../positions';
import {
  PRIORITIES, avatarSrc, initials, summaryFromDetail, fromNow,
} from '../boardUtils';
import { LabelChip, LabelSwatch, DueBadge } from '../BoardChips';
import MonoTag, { PriorityTag } from '@/components/MonoTag';
import { MonoArt } from '@/components/MonoEmpty';
import ActivityFeed from '../ActivityFeed';
import CardChecklists from './CardChecklists';
import CardComments from './CardComments';
import CardAttachments from './CardAttachments';

function Section({ icon, title, extra, children }) {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-center gap-2 border-b border-line pb-1.5">
        <span className="text-fg">{icon}</span>
        <h3 className="m-0 flex-1 font-display text-[14px] font-bold tracking-tight text-fg">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <div className="eyebrow mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function TitleEditor({ value, canEdit, onSave }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const shown = focused ? draft : value;
  return (
    <Input.TextArea
      value={shown}
      readOnly={!canEdit}
      variant="borderless"
      autoSize
      onFocus={() => { setDraft(value); setFocused(true); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const v = draft.replace(/\s+/g, ' ').trim();
        if (v && v !== value) onSave(v);
      }}
      onPressEnter={(e) => { e.preventDefault(); e.currentTarget.blur(); }}
      style={{ fontSize: 20, fontWeight: 800, padding: '2px 4px', color: 'var(--c-fg)', fontFamily: 'var(--ff-display)', letterSpacing: '-0.02em' }}
    />
  );
}

function DescriptionEditor({ value, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (editing) {
    return (
      <div>
        <Input.TextArea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoSize={{ minRows: 4, maxRows: 18 }}
          placeholder="Add a more detailed description…"
        />
        <div className="mt-2 flex gap-2">
          <Button type="primary" size="small" onClick={() => { setEditing(false); if (draft !== (value || '')) onSave(draft); }}>Save</Button>
          <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div
      onClick={() => canEdit && (setDraft(value || ''), setEditing(true))}
      className={`min-h-[56px] whitespace-pre-wrap break-words rounded-md border px-3 py-2 text-[13px] leading-relaxed transition-colors ${
        value ? 'border-transparent text-fg' : 'border-dashed border-line-2 bg-surface-2 text-fg-3'
      } ${canEdit ? 'cursor-pointer hover:border-fg' : ''}`}
    >
      {value || (canEdit ? 'Add a more detailed description…' : 'No description')}
    </div>
  );
}

function CardActivityTab({ cardId, context }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getCardActivity(cardId)
      .then((data) => !cancelled && setItems(Array.isArray(data) ? data : data?.items || []))
      .catch(() => !cancelled && setItems([]));
    return () => { cancelled = true; };
  }, [cardId]);
  if (items === null) return <Skeleton active avatar={{ size: 28 }} title={{ width: '40%' }} paragraph={{ rows: 1 }} />;
  return <ActivityFeed items={items} context={context} />;
}

/**
 * Card detail modal, opened from `?card=<id>`. Keeps a local CardDetail and
 * pushes a CardSummary back into the board state on every change.
 * `signal` / `commentSignal` change when realtime events for this card arrive.
 */
export default function CardModal({ cardId, onClose, signal, commentSignal }) {
  const { state, dispatch, canEdit, isOwner } = useBoard();
  const { user: me } = useAuth();
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const detailRef = useRef(null);
  const commentCountRef = useRef(undefined);

  // Apply an updater to the detail and mirror it onto the board tile.
  const commit = useCallback((fn) => {
    const current = detailRef.current;
    if (!current) return;
    const next = fn(current);
    detailRef.current = next;
    setDetail(next);
    dispatch({ type: 'card/upsert', card: summaryFromDetail(next, commentCountRef.current) });
  }, [dispatch]);

  const load = useCallback(() => getCard(cardId).then((d) => {
    detailRef.current = d;
    setDetail(d);
  }), [cardId]);

  useEffect(() => {
    load().catch((err) => setLoadError({ status: err?.response?.status, message: errorMessage(err, 'Failed to load card') }));
  }, [load]);

  // Realtime: refetch the card when another user changed it.
  const lastSignal = useRef(signal);
  useEffect(() => {
    if (!signal || signal === lastSignal.current) return;
    lastSignal.current = signal;
    load().catch(() => {});
  }, [signal, load]);

  const patch = async (localPatch, call, errText = 'Failed to update card') => {
    const prev = detailRef.current;
    commit((d) => ({ ...d, ...localPatch }));
    try {
      const res = await call();
      // Merge server truth when it looks like a card (CardSummary or CardDetail).
      if (res?.id === cardId && res.title !== undefined) {
        commit((d) => ({ ...d, ...res, checklists: res.checklists || d.checklists, attachments: res.attachments || d.attachments }));
      }
    } catch (err) {
      detailRef.current = prev;
      setDetail(prev);
      dispatch({ type: 'card/upsert', card: summaryFromDetail(prev, commentCountRef.current) });
      message.error(errorMessage(err, errText));
    }
  };

  const membersById = useMemo(() => Object.fromEntries(state.members.map((m) => [m.userId, m.user])), [state.members]);
  const activityContext = useMemo(() => ({
    lists: state.lists,
    members: state.members,
    cardsById: Object.fromEntries(state.cards.map((c) => [c.id, c])),
  }), [state.lists, state.members, state.cards]);

  // ── Loading / error ───────────────────────────────────────────────────
  if (!detail) {
    return (
      <Modal open onCancel={onClose} footer={null} width={860} centered>
        {loadError ? (
          <Result
            status={loadError.status === 403 ? 'warning' : 'error'}
            icon={<MonoArt kind={loadError.status === 404 ? '404' : loadError.status === 403 ? '403' : 'error'} />}
            title={loadError.status === 404 ? 'Card not found' : 'Could not open card'}
            subTitle={loadError.message}
          />
        ) : (
          <div className="py-6"><Skeleton active title={{ width: '50%' }} paragraph={{ rows: 6 }} /></div>
        )}
      </Modal>
    );
  }

  const list = state.lists.find((l) => l.id === detail.listId);
  const completed = !!detail.completedAt;

  // ── Mutations ─────────────────────────────────────────────────────────
  const saveTitle = (title) => patch({ title }, () => updateCard(cardId, { title }));
  const saveDescription = (description) => patch({ description }, () => updateCard(cardId, { description }));
  const setPriority = (priority) => patch({ priority: priority ?? null }, () => updateCard(cardId, { priority: priority ?? null }));
  const setDate = (field, value) => {
    const iso = value ? value.toISOString() : null;
    patch({ [field]: iso }, () => updateCard(cardId, { [field]: iso }));
  };
  const toggleComplete = () => patch(
    { completedAt: completed ? null : new Date().toISOString() },
    () => updateCard(cardId, { completed: !completed }),
  );
  const changeList = (listId) => {
    if (listId === detail.listId) return;
    const position = positionAtEnd(state.cards.filter((c) => c.listId === listId && c.id !== cardId));
    patch({ listId, position }, () => moveCard(cardId, listId, position), 'Failed to move card');
  };
  const changeAssignees = (userIds) => patch(
    { assignees: userIds.map((id) => membersById[id]).filter(Boolean) },
    () => setCardAssignees(cardId, userIds),
  );
  const changeLabels = (labelIds) => patch({ labelIds }, () => setCardLabels(cardId, labelIds));
  const archive = async () => {
    try {
      await deleteCard(cardId);
      dispatch({ type: 'card/remove', id: cardId });
      message.success('Card archived');
      onClose();
    } catch (err) {
      message.error(errorMessage(err, 'Failed to archive card'));
    }
  };

  const assigneeIds = (detail.assignees || []).map((u) => u.id);
  const counts = summaryFromDetail(detail).counts;

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={880}
      style={{ top: 32, maxWidth: 'calc(100vw - 16px)' }}
      styles={{ body: { paddingTop: 4 } }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start gap-2 pr-8">
        <CreditCardOutlined className="mt-3 text-fg" />
        <div className="min-w-0 flex-1">
          <TitleEditor value={detail.title} canEdit={canEdit} onSave={saveTitle} />
          <div className="flex flex-wrap items-center gap-2 px-1 text-[12px] text-fg-2">
            <span>in list <b className="text-fg underline decoration-1 underline-offset-2">{list?.name || '—'}</b></span>
            {detail.source === 'message' && (
              <MonoTag variant="dashed" icon={<MessageOutlined />}>via message</MonoTag>
            )}
            {completed && <MonoTag variant="solid" icon={<CheckOutlined />}>Completed</MonoTag>}
            {detail.createdBy?.name && <span>· created by {detail.createdBy.name} {fromNow(detail.createdAt)}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Main column */}
        <div className="min-w-0 flex-1">
          {(detail.labelIds?.length > 0 || detail.assignees?.length > 0 || detail.dueDate) && (
            <div className="mb-5 flex flex-wrap gap-5">
              {detail.assignees?.length > 0 && (
                <Field label="Members">
                  <Avatar.Group size={28}>
                    {detail.assignees.map((u) => (
                      <Tooltip key={u.id} title={u.name}>
                        <Avatar src={avatarSrc(u)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)' }}>{initials(u.name)}</Avatar>
                      </Tooltip>
                    ))}
                  </Avatar.Group>
                </Field>
              )}
              {detail.labelIds?.length > 0 && (
                <Field label="Labels">
                  <div className="flex flex-wrap gap-1">
                    {detail.labelIds.map((id) => state.labels.find((l) => l.id === id)).filter(Boolean).map((l) => (
                      <LabelChip key={l.id} label={l} size="md" />
                    ))}
                  </div>
                </Field>
              )}
              {detail.dueDate && (
                <Field label="Due">
                  <DueBadge
                    dueDate={detail.dueDate}
                    completedAt={detail.completedAt}
                    format={(d) => dayjs(d).format('MMM D, YYYY h:mm A')}
                    suffix
                  />
                </Field>
              )}
            </div>
          )}

          <Section icon={<AlignLeftOutlined />} title="Description">
            <DescriptionEditor value={detail.description} canEdit={canEdit} onSave={saveDescription} />
          </Section>

          <Section icon={<CheckSquareOutlined />} title="Checklists">
            <CardChecklists cardId={cardId} checklists={detail.checklists} commit={commit} canEdit={canEdit} />
          </Section>

          <Section icon={<PaperClipOutlined />} title={`Attachments${counts.attachments ? ` (${counts.attachments})` : ''}`}>
            <CardAttachments
              cardId={cardId}
              attachments={detail.attachments}
              commit={commit}
              canEdit={canEdit}
              onRefetch={() => load().then(() => commit((d) => d)).catch(() => {})}
            />
          </Section>

          <Tabs
            size="small"
            items={[
              {
                key: 'comments',
                label: <span><CommentOutlined /> Comments</span>,
                children: (
                  <CardComments
                    cardId={cardId}
                    members={state.members}
                    me={me}
                    canEdit={canEdit}
                    isOwner={isOwner}
                    refreshKey={commentSignal?.at ?? 0}
                    onCountChange={(n) => {
                      commentCountRef.current = n;
                      dispatch({ type: 'card/counts', id: cardId, counts: () => ({ comments: n }) });
                    }}
                  />
                ),
              },
              {
                key: 'activity',
                label: 'Activity',
                children: <CardActivityTab cardId={cardId} context={activityContext} />,
              },
            ]}
          />
        </div>

        {/* Side column */}
        <aside className="w-full shrink-0 md:w-[220px]">
          <Field label="List">
            <Select
              value={detail.listId}
              onChange={changeList}
              disabled={!canEdit}
              options={state.lists.map((l) => ({ value: l.id, label: l.name }))}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Assignees">
            <Select
              mode="multiple"
              value={assigneeIds}
              onChange={changeAssignees}
              disabled={!canEdit}
              placeholder="Assign members"
              showSearch={{ optionFilterProp: 'search' }}
              style={{ width: '100%' }}
              options={state.members.map((m) => ({
                value: m.userId,
                search: `${m.user?.name} ${m.user?.email}`,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar size={16} src={avatarSrc(m.user)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 8 }}>{initials(m.user?.name)}</Avatar>
                    {m.user?.name}
                  </span>
                ),
              }))}
            />
          </Field>
          <Field label="Labels">
            <Select
              mode="multiple"
              value={detail.labelIds || []}
              onChange={changeLabels}
              disabled={!canEdit}
              placeholder={state.labels.length ? 'Add labels' : 'No labels on this board'}
              showSearch={{ optionFilterProp: 'search' }}
              style={{ width: '100%' }}
              options={state.labels.map((l) => ({
                value: l.id,
                search: l.name,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <LabelSwatch color={l.color} />
                    {l.name}
                  </span>
                ),
              }))}
            />
          </Field>
          <Field label="Start date">
            <DatePicker
              value={detail.startDate ? dayjs(detail.startDate) : null}
              onChange={(v) => setDate('startDate', v)}
              disabled={!canEdit}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Due date">
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              value={detail.dueDate ? dayjs(detail.dueDate) : null}
              onChange={(v) => setDate('dueDate', v)}
              disabled={!canEdit}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Priority">
            <Select
              allowClear
              value={detail.priority || undefined}
              onChange={setPriority}
              disabled={!canEdit}
              placeholder="None"
              style={{ width: '100%' }}
              options={PRIORITIES.map((p) => ({ value: p.value, label: <PriorityTag priority={p.value} label={p.label} /> }))}
            />
          </Field>

          {canEdit && (
            <div className="mt-5 flex flex-col gap-2">
              <Button
                block
                type={completed ? 'default' : 'primary'}
                icon={completed ? <UndoOutlined /> : <CheckOutlined />}
                onClick={toggleComplete}
              >
                {completed ? 'Mark incomplete' : 'Mark complete'}
              </Button>
              <Popconfirm title="Archive this card?" okText="Archive" okButtonProps={{ danger: true }} onConfirm={archive}>
                <Button block danger type="primary" icon={<DeleteOutlined />}>Archive card</Button>
              </Popconfirm>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
