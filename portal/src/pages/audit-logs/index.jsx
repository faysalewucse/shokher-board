import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Table, Select, Space, Typography, Tooltip, Button } from 'antd';
import DateRangePicker from '@/components/DateRangePicker';
import {
  CodeOutlined, AuditOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined,
} from '@ant-design/icons';
import MonoTag from '@/components/MonoTag';
import PageHeader from '@/components/PageHeader';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

// Monochrome action chips: style + icon instead of hue.
const ACTION_LOOK = {
  created:        { variant: 'outline', icon: <PlusOutlined /> },
  updated:        { variant: 'soft',    icon: <EditOutlined /> },
  deleted:        { variant: 'solid',   icon: <DeleteOutlined /> },
  status_changed: { variant: 'dashed',  icon: <SwapOutlined /> },
};

const ACTION_LABEL = {
  created:        'Created',
  updated:        'Updated',
  deleted:        'Deleted',
  status_changed: 'Status Changed',
};

const ENTITY_TYPES = ['User', 'Role', 'Config', 'Notification'];

const FIELD_LABELS = {
  name:                'Name',
  email:               'Email',
  phone:               'Phone',
  role:                'Role',
  roleId:              'Role',
  status:              'Status',
  title:               'Title',
  description:         'Description',
  supportEmail:        'Support Email',
  supportNumbers:      'Support Numbers',
  maintenanceMode:     'Maintenance Mode',
  maintenanceMessage:  'Maintenance Message',
  registrationEnabled: 'Registration Enabled',
};

// Which field holds the display name for each entity type
const ENTITY_NAME_FIELD = {
  Notification: 'title',
};

// Key fields to show in snapshot summary for deleted records (excluding name/title)
const ENTITY_SNAPSHOT_FIELDS = {
  User: ['email', 'phone'],
};
const entityName = (entityType, changes) => {
  const field = ENTITY_NAME_FIELD[entityType] || 'name';
  return changes?.after?.[field] || changes?.snapshot?.[field] || changes?.input?.[field] || null;
};

// Portal edit/detail route for each entity type (null = no direct link)
const ENTITY_EDIT_PATH = {};

const labelFor = (key) =>
  FIELD_LABELS[key] ||
  key.split('.').map((w) => w.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())).join(' → ');

const formatValue = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? `[${v.length} items]` : '(empty)';
  if (typeof v === 'object') return '{…}';
  return String(v);
};

const flattenInput = (obj, prefix = '', depth = 0) => {
  const result = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      result[key] = v;
    } else if (v !== null && typeof v === 'object' && depth < 2) {
      Object.assign(result, flattenInput(v, key, depth + 1));
    } else {
      result[key] = v;
    }
  }
  return result;
};

function ActivityCell({ row, roleMap }) {
  const [showRaw, setShowRaw] = useState(false);
  const { actor, action, entityType, entityId, changes } = row;

  const flat       = flattenInput(changes?.input  || {});
  const flatBefore = flattenInput(changes?.before || {});
  const keys       = Object.keys(flat);
  const isDev      = import.meta.env.VITE_APP_ENV === 'development';

  const name    = entityName(entityType, changes);
  const editFn  = ENTITY_EDIT_PATH[entityType];
  const editUrl = editFn ? editFn(entityId) : null;

  const resolveValue = (key, v) => {
    if (['role', 'roleId'].includes(key) && v && roleMap?.[v]) return roleMap[v];
    return formatValue(v);
  };

  const changeItems = (action === 'deleted' || action === 'created' || !keys.length) ? [] : keys.map((k) => {
    const oldVal = flatBefore[k] !== undefined ? resolveValue(k, flatBefore[k]) : null;
    const newVal = resolveValue(k, flat[k]);
    return oldVal !== null ? (
      <span key={k}>
        {labelFor(k)} from{' '}
        <span style={{ color: 'var(--c-fg-3)', textDecoration: 'line-through' }}>{oldVal}</span>
        {' → '}
        <strong style={{ color: 'var(--c-fg)' }}>{newVal}</strong>
      </span>
    ) : (
      <span key={k}>{labelFor(k)}: <strong>{newVal}</strong></span>
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, lineHeight: 1.6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {actor?.name ?? <Text type="secondary">Unknown</Text>}
        </Text>
        <MonoTag variant={ACTION_LOOK[action]?.variant || 'soft'} icon={ACTION_LOOK[action]?.icon}>
          {ACTION_LABEL[action] || action}
        </MonoTag>
        <MonoTag variant="muted" className="mono">{entityType}</MonoTag>
        {action === 'deleted' && <MonoTag variant="dashed" strike>Record deleted</MonoTag>}
        {name && (
          editUrl && action !== 'deleted'
            ? <Link to={editUrl} style={{ fontSize: 12, fontWeight: 600 }}>{name}</Link>
            : <Text style={{ fontSize: 12, fontWeight: 600 }}>{name}</Text>
        )}
        {changeItems.length > 0 && (
          <Text style={{ fontSize: 12, color: 'var(--c-fg-2)' }}>
            {changeItems.reduce((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
          </Text>
        )}
      </div>

      {showRaw && (
        <pre style={{ margin: '4px 0 0', fontSize: 11, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--c-surface-2)', border: '1px solid var(--c-line)', fontFamily: 'var(--ff-mono)', padding: '6px 8px', borderRadius: 4 }}>
          {JSON.stringify(changes, null, 2)}
        </pre>
      )}

      {isDev && (
        <Button
          type="link"
          size="small"
          icon={<CodeOutlined />}
          style={{ padding: 0, fontSize: 11, height: 'auto' }}
          onClick={() => setShowRaw((s) => !s)}
        >
          {showRaw ? 'Hide raw' : 'Raw'}
        </Button>
      )}
    </div>
  );
}

export default function AuditLogs() {
  const [logs, setLogs]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction]         = useState('');
  const [dateRange, setDateRange]   = useState([]);
  const [roleMap, setRoleMap] = useState({});

  useEffect(() => {
    api.get('/roles')
      .then(({ data }) => {
        const map = {};
        (data.data || []).forEach((r) => { map[r.id] = r.name; });
        setRoleMap(map);
      })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 50 };
      if (entityType) params.entityType = entityType;
      if (action)     params.action = action;
      if (dateRange?.length === 2) {
        params.startDate = dateRange[0].startOf('day').toISOString();
        params.endDate   = dateRange[1].endOf('day').toISOString();
      }
      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.data);
      setTotal(res.data.meta?.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [entityType, action, dateRange]);

  useEffect(() => { setPage(1); fetchLogs(1); }, [entityType, action, dateRange]);
  useEffect(() => { fetchLogs(page); }, [page]);

  const columns = [
    {
      title: 'Activity',
      key: 'activity',
      render: (_, row) => <ActivityCell row={row} roleMap={roleMap} />,
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      width: 130,
      render: (v) => (
        <Tooltip title={dayjs(v).format('YYYY-MM-DD hh:mm:ss A')}>
          <Text type="secondary" className="mono" style={{ fontSize: 11.5 }}>{dayjs(v).format('MMM D, hh:mm A')}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Record ID',
      dataIndex: 'entityId',
      width: 180,
      render: (v) => (
        <Text copyable={{ text: v }} style={{ fontSize: 11, fontFamily: 'var(--ff-mono)', color: 'var(--c-fg-2)' }}>
          {v?.slice(0, 16)}…
        </Text>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      width: 120,
      render: (v) => <Text type="secondary" className="mono" style={{ fontSize: 11 }}>{v || '—'}</Text>,
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" count={total} icon={<AuditOutlined />} />
      <div className="panel rise rise-1" style={{ padding: '16px 20px' }}>
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Select
          placeholder="Module"
          allowClear
          style={{ width: 160 }}
          value={entityType || undefined}
          onChange={(v) => setEntityType(v ?? '')}
          options={ENTITY_TYPES.map((e) => ({ value: e, label: e }))}
        />
        <Select
          placeholder="Action"
          allowClear
          style={{ width: 150 }}
          value={action || undefined}
          onChange={(v) => setAction(v ?? '')}
          options={[
            { value: 'created',        label: 'Created' },
            { value: 'updated',        label: 'Updated' },
            { value: 'deleted',        label: 'Deleted' },
            { value: 'status_changed', label: 'Status Changed' },
          ]}
        />
        <DateRangePicker
          value={dateRange.length ? dateRange : null}
          onChange={(v) => setDateRange(v || [])}
        />
      </Space>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          current: page,
          total,
          pageSize: 50,
          showTotal: (t) => `${t} logs`,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        scroll={{ x: 700 }}
      />
    </div>
    </div>
  );
}
