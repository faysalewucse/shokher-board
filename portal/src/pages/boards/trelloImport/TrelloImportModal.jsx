import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Avatar, Button, Form, Input, Modal, Select, Spin, Steps, Switch, Tooltip, Upload, message,
} from 'antd';
import {
  ExclamationCircleOutlined, FileTextOutlined, InboxOutlined, InfoCircleOutlined, LinkOutlined,
} from '@ant-design/icons';
import MonoTag from '@/components/MonoTag';
import useDebounce from '@/hooks/useDebounce';
import { errorMessage, getProjects, importTrelloBoard, lookupUsers } from '@/services/boards';
import { avatarSrc, initials } from '../boardUtils';
import { matchUser, normalizeTrello, parseTrelloExport, trelloCounts } from './normalizeTrello';

const MAX_FILE_MB = 100;
const NO_MAP = '__none__';

const avatarStyle = { background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 10 };

const readText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the file.'));
  reader.readAsText(file);
});

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One summary tile in the preview grid. */
function Stat({ label, value, hint }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="mono tnum text-[18px] font-bold leading-tight text-fg">{value}</div>
      <div className="text-[11.5px] text-fg-3">{label}{hint && <span> · {hint}</span>}</div>
    </div>
  );
}

const userOption = (u) => ({
  value: u.id,
  search: `${u.name} ${u.email}`,
  label: (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size={18} src={avatarSrc(u)} style={avatarStyle}>{initials(u.name)}</Avatar>
      <span className="truncate">{u.name}</span>
      <span className="truncate text-fg-3">{u.email}</span>
    </span>
  ),
});

/** Searchable user select (GET /users/lookup) with a "Don't map" entry. */
function UserPicker({ value, onChange, seed }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [result, setResult] = useState({ q: '', users: [] }); // last finished search
  const searching = !!debounced && result.q !== debounced;

  useEffect(() => {
    if (!debounced) return undefined;
    let cancelled = false;
    lookupUsers(debounced, 20)
      .then((users) => !cancelled && setResult({ q: debounced, users: users || [] }))
      .catch(() => !cancelled && setResult({ q: debounced, users: [] }));
    return () => { cancelled = true; };
  }, [debounced]);

  const users = useMemo(() => {
    const list = debounced && result.q === debounced ? result.users : seed;
    const selected = seed.find((u) => u.id === value);
    return selected && !list.some((u) => u.id === value) ? [selected, ...list] : list;
  }, [debounced, result, seed, value]);

  return (
    <Select
      size="small"
      value={value || NO_MAP}
      onChange={(v) => onChange(v === NO_MAP ? null : v)}
      showSearch={{ filterOption: false, onSearch: setQuery }}
      onOpenChange={(open) => !open && setQuery('')}
      notFoundContent={searching ? <Spin size="small" /> : 'No users'}
      style={{ width: '100%' }}
      popupMatchSelectWidth={320}
      options={[
        { value: NO_MAP, label: <span className="text-fg-3">Don&apos;t map</span> },
        ...users.map(userOption),
      ]}
    />
  );
}

/**
 * Import a Trello board export: pick file (parsed locally) → review options
 * and member mapping → POST /boards/import/trello → open the new board.
 */
export default function TrelloImportModal({ open, onClose }) {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState(null);
  const [reading, setReading] = useState(false);
  const [data, setData] = useState(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [projects, setProjects] = useState(null);
  const [projectsDenied, setProjectsDenied] = useState(false);
  const [seedUsers, setSeedUsers] = useState([]);
  const [memberMap, setMemberMap] = useState({});
  const [matching, setMatching] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importName, setImportName] = useState('');

  const reset = () => {
    setStep(0); setFileName(''); setParseError(null); setData(null); setIncludeArchived(false);
    setMemberMap({}); setImportError(null); form.resetFields();
  };

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    getProjects()
      .then((d) => !cancelled && setProjects(Array.isArray(d) ? d : d?.items || []))
      .catch((err) => {
        if (cancelled) return;
        setProjects([]);
        if (err?.response?.status === 403) setProjectsDenied(true);
      });
    return () => { cancelled = true; };
  }, [open]);

  // Auto-match Trello members against ShokherBoard users once a file is loaded.
  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    setMatching(true);
    (async () => {
      const pool = new Map();
      const add = (users) => (users || []).forEach((u) => pool.set(u.id, u));
      try {
        add(await lookupUsers('', 50));
        const terms = [...new Set(data.members.flatMap((m) => [m.fullName, m.username]).map((s) => s?.trim()).filter(Boolean))];
        for (let i = 0; i < terms.length; i += 5) {
          const batch = await Promise.all(terms.slice(i, i + 5).map((t) => lookupUsers(t, 10).catch(() => [])));
          batch.forEach(add);
        }
      } catch { /* matching is best-effort */ }
      if (cancelled) return;
      const users = [...pool.values()].sort((a, b) => a.name.localeCompare(b.name));
      const map = {};
      data.members.forEach((m) => { map[m.id] = matchUser(m, users)?.id || null; });
      setSeedUsers(users);
      setMemberMap(map);
      setMatching(false);
    })();
    return () => { cancelled = true; };
  }, [data]);

  const counts = useMemo(() => (data ? trelloCounts(data, includeArchived) : null), [data, includeArchived]);

  const handleFile = async (file) => {
    setParseError(null);
    setFileName(file.name);
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setParseError(`The file is larger than ${MAX_FILE_MB} MB.`);
      return Upload.LIST_IGNORE;
    }
    setReading(true);
    try {
      const raw = parseTrelloExport(await readText(file));
      const normalized = normalizeTrello(raw);
      setData(normalized);
      form.setFieldsValue({ name: (normalized.board.name || 'Imported board').slice(0, 200) });
      setStep(1);
    } catch (err) {
      setParseError(err.message || 'Could not read this file.');
    } finally {
      setReading(false);
    }
    return Upload.LIST_IGNORE; // never upload — everything is parsed locally
  };

  const runImport = async () => {
    const values = await form.validateFields();
    setImportError(null);
    setImportName(values.name.trim());
    setStep(2);
    try {
      const res = await importTrelloBoard({
        name: values.name.trim(),
        projectId: values.projectId || null,
        includeArchived,
        memberMap: Object.fromEntries(Object.entries(memberMap).filter(([, v]) => v)),
        data,
      });
      const c = res?.counts || {};
      message.success(`Imported ${[
        plural(c.lists ?? 0, 'list'), plural(c.cards ?? 0, 'card'),
        c.checklistItems ? plural(c.checklistItems, 'checklist item') : null,
        c.comments ? plural(c.comments, 'comment') : null,
        c.attachments ? plural(c.attachments, 'attachment') : null,
      ].filter(Boolean).join(', ')}`, 6);
      reset();
      onClose();
      if (res?.board?.id) navigate(`/boards/${res.board.id}`);
    } catch (err) {
      setImportError(errorMessage(err, 'Import failed'));
      setStep(1);
    }
  };

  const close = () => {
    if (step === 2) return;
    reset();
    onClose();
  };

  const mappedCount = Object.values(memberMap).filter(Boolean).length;
  const archivedHint = (n) => (n ? `${n} archived ${includeArchived ? 'included' : 'skipped'}` : null);

  const footer = step === 0 ? [
    <Button key="cancel" onClick={close}>Cancel</Button>,
  ] : step === 1 ? [
    <Button key="back" onClick={() => { setStep(0); setImportError(null); }}>Back</Button>,
    <Button key="import" type="primary" onClick={runImport} disabled={matching}>
      Import {counts ? plural(counts.cards, 'card') : ''}
    </Button>,
  ] : null;

  return (
    <Modal
      title="Import from Trello"
      open={open}
      onCancel={close}
      footer={footer}
      width={760}
      closable={step !== 2}
      maskClosable={false}
      destroyOnHidden
    >
      <Steps
        size="small"
        current={step}
        className="mb-5! mt-2!"
        items={[{ title: 'Choose file' }, { title: 'Review' }, { title: 'Import' }]}
      />

      {step === 0 && (
        <div>
          <Upload.Dragger
            accept=".json,application/json"
            multiple={false}
            showUploadList={false}
            beforeUpload={handleFile}
            disabled={reading}
          >
            <p className="ant-upload-drag-icon">{reading ? <Spin /> : <InboxOutlined />}</p>
            <p className="ant-upload-text">Drop a Trello board export (.json) here, or click to choose</p>
            <p className="ant-upload-hint">The file is read in your browser — only the board data needed for the import is sent.</p>
          </Upload.Dragger>

          {parseError && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-fg px-3 py-2 text-[13px] text-fg">
              <ExclamationCircleOutlined className="mt-0.5" />
              <div>
                <div className="font-semibold">Couldn&apos;t import {fileName ? <span className="mono">{fileName}</span> : 'this file'}</div>
                <div className="text-fg-2">{parseError}</div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-md bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">
            <div className="mb-1 font-semibold text-fg"><InfoCircleOutlined /> How to export from Trello</div>
            Open the board in Trello → <b>Menu</b> (⋯) → <b>Print, export and share</b> → <b>Export as JSON</b>, then save the page as a <span className="mono">.json</span> file.
          </div>
        </div>
      )}

      {step >= 1 && data && counts && (
        <div className={`flex flex-col gap-4 ${step === 2 ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 text-[12.5px] text-fg-3">
            <FileTextOutlined /> <span className="mono truncate">{fileName}</span>
            <span>· Trello board “{data.board.name}”</span>
          </div>

          <Form form={form} layout="vertical" requiredMark={false} className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="name" label="Board name" rules={[{ required: true, whitespace: true, message: 'Board name is required' }]} className="mb-3!">
              <Input maxLength={200} />
            </Form.Item>
            {!projectsDenied ? (
              <Form.Item name="projectId" label="Project" className="mb-3!">
                <Select
                  allowClear
                  loading={projects === null}
                  placeholder="No project (standalone)"
                  showSearch={{ optionFilterProp: 'search' }}
                  options={(projects || []).map((p) => ({
                    value: p.id,
                    search: `${p.name} ${p.client?.name || ''}`,
                    label: <span>{p.name}{p.client?.name && <span className="text-fg-3"> · {p.client.name}</span>}</span>,
                  }))}
                />
              </Form.Item>
            ) : (
              <div className="self-center text-[12px] text-fg-3">This board will be standalone.</div>
            )}
          </Form>

          <div>
            <div className="eyebrow mb-2">What will be imported</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Lists" value={counts.lists} hint={archivedHint(counts.archivedLists)} />
              <Stat label="Cards" value={counts.cards} hint={archivedHint(counts.archivedCards)} />
              <Stat label="Labels" value={counts.labels} />
              <Stat label="Checklists" value={counts.checklists} hint={plural(counts.checklistItems, 'item')} />
              <Stat label="Comments" value={counts.comments} />
              <Stat label="Attachments" value={counts.attachments} hint="as links" />
              <Stat label="Members" value={counts.members} hint={`${mappedCount} mapped`} />
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-fg">
              <Switch size="small" checked={includeArchived} onChange={setIncludeArchived} />
              Include archived lists &amp; cards
              <span className="text-fg-3">— they are imported as archived</span>
            </label>
            <div className="mt-2 text-[12px] text-fg-3">
              <InfoCircleOutlined /> Trello exports only the ~1000 most recent actions, so very old comments may be missing.
              Attachments are imported as links to Trello <LinkOutlined />.
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="eyebrow">Members</span>
              <span className="text-[12px] text-fg-3">Mapped people join the board and keep their card and checklist assignments.</span>
              {matching && <Spin size="small" className="ml-auto" />}
            </div>
            {data.members.length === 0 ? (
              <div className="text-[12px] text-fg-3">No members in this export.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-line">
                {data.members.map((m) => (
                  <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar size={24} style={avatarStyle}>{initials(m.fullName || m.username)}</Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-fg">{m.fullName || m.username || 'Unknown'}</div>
                        {m.username && <div className="mono truncate text-[11px] text-fg-3">@{m.username}</div>}
                      </div>
                      {memberMap[m.id] && <MonoTag variant="soft" className="ml-auto shrink-0">matched</MonoTag>}
                    </div>
                    <UserPicker
                      value={memberMap[m.id]}
                      seed={seedUsers}
                      onChange={(v) => setMemberMap((prev) => ({ ...prev, [m.id]: v }))}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1.5 text-[11.5px] text-fg-3">
              Comments by unmapped people are posted by you with an “Originally by … on Trello” note.
            </div>
          </div>

          {importError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-fg px-3 py-2 text-[13px] text-fg">
              <ExclamationCircleOutlined className="mt-0.5" />
              <div><span className="font-semibold">Import failed.</span> <span className="text-fg-2">{importError}</span></div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Spin size="large" />
          <div className="font-display text-[15px] font-bold text-fg">Importing “{importName}”…</div>
          <Tooltip title="Large boards can take up to a minute">
            <div className="text-[12.5px] text-fg-3">
              Creating {counts ? `${plural(counts.lists, 'list')} and ${plural(counts.cards, 'card')}` : 'the board'} — keep this window open.
            </div>
          </Tooltip>
        </div>
      )}
    </Modal>
  );
}
