import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Button, Input, Table, Tooltip, message } from 'antd';
import {
  ContactsOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, InboxOutlined, MailOutlined, PhoneOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import MonoEmpty from '@/components/MonoEmpty';
import NoAccess from '@/components/NoAccess';
import { CountPill } from '@/components/MonoTag';
import usePermission from '@/hooks/usePermission';
import useDebounce from '@/hooks/useDebounce';
import { errorMessage } from '@/services/boards';
import { getClients, createClient, updateClient, archiveClient } from '@/services/projects';
import { initials } from '@/pages/boards/boardUtils';
import ClientFormModal from './ClientFormModal';

const dash = <span className="text-fg-3">—</span>;

export default function Clients() {
  const navigate = useNavigate();
  const canRead = usePermission('CLIENT_READ');
  const canManage = usePermission('CLIENT_MANAGE');

  const [clients, setClients] = useState(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [modal, setModal] = useState(null); // null | { client? }

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const data = await getClients({ q: debouncedQuery || undefined });
      setClients(data || []);
    } catch (err) {
      setClients([]);
      if (err?.response?.status === 403) setDenied(true);
      else message.error(errorMessage(err, 'Failed to load clients'));
    } finally {
      setLoading(false);
    }
  }, [canRead, debouncedQuery]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (values) => {
    const editing = modal?.client;
    try {
      if (editing) {
        await updateClient(editing.id, values);
        message.success('Client updated');
      } else {
        const created = await createClient(values);
        message.success('Client created');
        setModal(null);
        if (created?.id) navigate(`/clients/${created.id}`);
        return;
      }
      setModal(null);
      load();
    } catch (err) {
      message.error(errorMessage(err, 'Failed to save client'));
      throw err;
    }
  };

  const handleArchive = async (client) => {
    try {
      await archiveClient(client.id);
      message.success(`“${client.name}” archived`);
      setClients((prev) => (prev || []).filter((c) => c.id !== client.id));
    } catch (err) {
      message.error(errorMessage(err, 'Failed to archive client'));
    }
  };

  if (!canRead || denied) {
    return <NoAccess hint="Ask an admin for the Clients read permission.">You don’t have access to clients.</NoAccess>;
  }

  const columns = [
    {
      title: 'Client',
      key: 'name',
      render: (_, c) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            shape="square"
            size={34}
            style={{ background: 'var(--c-surface-3)', color: 'var(--c-fg)', border: '1px solid var(--c-line)', borderRadius: 4, fontWeight: 700, fontSize: 12, flexShrink: 0 }}
          >
            {initials(c.name)}
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-fg">{c.name}</div>
            <div className="truncate text-xs text-fg-3">{c.company || 'No company'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      responsive: ['md'],
      render: (v) => (v ? (
        <a href={`mailto:${v}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2! hover:text-fg! hover:underline">
          <MailOutlined className="text-fg-3" />{v}
        </a>
      ) : dash),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['lg'],
      render: (v) => (v ? (
        <span className="mono inline-flex items-center gap-1.5 text-[12px] text-fg-2"><PhoneOutlined className="text-fg-3" />{v}</span>
      ) : dash),
    },
    {
      title: 'Projects',
      dataIndex: 'projectCount',
      key: 'projectCount',
      align: 'center',
      width: 100,
      render: (v) => <CountPill value={v ?? 0} muted={!v} />,
    },
    {
      title: 'Added',
      dataIndex: 'createdAt',
      key: 'createdAt',
      responsive: ['xl'],
      render: (d) => <span className="mono text-[12px] text-fg-2">{new Date(d).toLocaleDateString()}</span>,
    },
    ...(canManage ? [{
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 100,
      render: (_, c) => (
        <RowActions
          onEdit={() => setModal({ client: c })}
          onDelete={() => handleArchive(c)}
          deleteTooltip="Archive"
          deleteOkText="Archive"
          deleteIcon={<InboxOutlined />}
          deleteConfirmTitle={`Archive “${c.name}”?`}
          deleteConfirmDescription="It will be hidden from client lists. Projects stay intact."
        />
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Clients"
        icon={<ContactsOutlined />}
        count={clients ? clients.length : null}
        subtitle="The people and companies you run projects for"
        actions={(
          <>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-fg-3" />}
              placeholder="Search name, company, email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 240 }}
            />
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={load} aria-label="Refresh" />
            </Tooltip>
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({})}>New client</Button>
            )}
          </>
        )}
      />

      <div className="rise rise-1">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={clients || []}
          loading={loading}
          pagination={(clients?.length || 0) > 20 ? { pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} clients` } : false}
          onRow={(c) => ({
            onClick: () => navigate(`/clients/${c.id}`),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: clients === null ? ' ' : (
              <MonoEmpty description={query ? 'No clients match your search' : 'No clients yet'}>
                {!query && canManage && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({})}>Add your first client</Button>
                )}
              </MonoEmpty>
            ),
          }}
        />
      </div>

      <ClientFormModal
        open={!!modal}
        initial={modal?.client}
        onCancel={() => setModal(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
