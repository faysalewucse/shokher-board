import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar, Button, Modal, Skeleton, message } from 'antd';
import {
  EditOutlined, InboxOutlined, PlusOutlined, RightOutlined, FolderOutlined, MailOutlined, PhoneOutlined,
} from '@ant-design/icons';
import MonoEmpty, { MonoArt } from '@/components/MonoEmpty';
import MonoTag from '@/components/MonoTag';
import NoAccess from '@/components/NoAccess';
import usePermission from '@/hooks/usePermission';
import { errorMessage } from '@/services/boards';
import { getClient, updateClient, archiveClient, getProjects, createProject } from '@/services/projects';
import { initials } from '@/pages/boards/boardUtils';
import ProjectCard from '@/pages/projects/ProjectCard';
import ProjectFormModal from '@/pages/projects/ProjectFormModal';
import { formatStamp } from '@/pages/projects/projectUtils';
import ClientFormModal from './ClientFormModal';

function Detail({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="eyebrow shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] text-fg">{children}</span>
    </div>
  );
}

const dash = <span className="text-fg-3">—</span>;

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canManage = usePermission('CLIENT_MANAGE');
  const canReadProjects = usePermission('PROJECT_READ');
  const canManageProjects = usePermission('PROJECT_MANAGE');

  const [client, setClient] = useState(null);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null); // null | 403 | 404 | 'error'
  const [editOpen, setEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getClient(id);
        // The full project list carries board counts + progress; fall back to the embedded list.
        let list = data.projects || [];
        if (canReadProjects) {
          try { list = await getProjects({ clientId: id }); } catch { /* keep embedded list */ }
        }
        if (cancelled) return;
        setClient(data);
        setProjects(list || []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        setError(status === 403 || status === 404 ? status : 'error');
        if (status !== 403 && status !== 404) message.error(errorMessage(err, 'Failed to load client'));
      }
    })();
    return () => { cancelled = true; };
  }, [id, canReadProjects]);

  const archive = () => {
    Modal.confirm({
      title: `Archive “${client.name}”?`,
      content: 'The client will be hidden from client lists. Its projects are kept.',
      okText: 'Archive',
      okButtonProps: { danger: true, type: 'primary' },
      onOk: async () => {
        try {
          await archiveClient(id);
          message.success('Client archived');
          navigate('/clients');
        } catch (err) {
          message.error(errorMessage(err, 'Failed to archive client'));
        }
      },
    });
  };

  const handleEdit = async (values) => {
    try {
      const updated = await updateClient(id, values);
      setClient((c) => ({ ...c, ...updated }));
      setEditOpen(false);
      message.success('Client updated');
    } catch (err) {
      message.error(errorMessage(err, 'Failed to update client'));
      throw err;
    }
  };

  const handleCreateProject = async (values) => {
    try {
      const project = await createProject(values);
      setProjectOpen(false);
      message.success('Project created');
      if (project?.id) navigate(`/projects/${project.id}`);
    } catch (err) {
      message.error(errorMessage(err, 'Failed to create project'));
      throw err;
    }
  };

  if (error === 403) {
    return <NoAccess hint="Ask an admin for the Clients read permission.">You don’t have access to this client.</NoAccess>;
  }
  if (error === 404 || error === 'error') {
    return (
      <div className="panel flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-fg-2">
        <MonoArt kind={error === 404 ? '404' : 'error'} size={96} />
        <span className="font-semibold text-fg">{error === 404 ? 'Client not found' : 'Couldn’t load this client'}</span>
        <Button onClick={() => navigate('/clients')}>Back to clients</Button>
      </div>
    );
  }
  if (!client) {
    return <div className="panel p-6"><Skeleton active avatar paragraph={{ rows: 5 }} /></div>;
  }

  const list = projects || [];

  return (
    <div>
      {/* Header */}
      <div className="panel rise mb-4 px-5 py-4">
        <div className="mono mb-2 flex items-center gap-1 truncate text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
          <Link to="/clients" className="text-fg-3! hover:text-fg! hover:underline">Clients</Link>
          <RightOutlined style={{ fontSize: 8 }} />
          <span className="truncate">{client.name}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar
              shape="square"
              size={44}
              style={{ background: 'var(--c-inv)', color: 'var(--c-on-inv)', borderRadius: 4, fontWeight: 800, fontSize: 16, flexShrink: 0, fontFamily: 'var(--ff-display)' }}
            >
              {initials(client.name)}
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="m-0 font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-fg">{client.name}</h1>
                {client.archivedAt && <MonoTag variant="dashed">Archived</MonoTag>}
              </div>
              <p className="mb-0 mt-0.5 text-[13px] text-fg-3">{client.company || 'No company'}</p>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>
              {!client.archivedAt && <Button danger icon={<InboxOutlined />} onClick={archive}>Archive</Button>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Side: details */}
        <div className="flex min-w-0 flex-col gap-4 lg:order-2">
          <section className="panel rise rise-1 px-5 py-3">
            <Detail label="Company">{client.company || dash}</Detail>
            <Detail label="Email">
              {client.email ? (
                <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 text-fg! hover:underline">
                  <MailOutlined className="text-fg-3" />{client.email}
                </a>
              ) : dash}
            </Detail>
            <Detail label="Phone">
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="mono inline-flex items-center gap-1.5 text-[12px] text-fg! hover:underline">
                  <PhoneOutlined className="text-fg-3" />{client.phone}
                </a>
              ) : dash}
            </Detail>
            <Detail label="Projects"><span className="mono tnum text-[12px]">{client.projectCount ?? list.length}</span></Detail>
            <Detail label="Added"><span className="mono text-[12px] text-fg-2">{formatStamp(client.createdAt)}</span></Detail>
          </section>
          <section className="panel rise rise-2 p-5">
            <div className="eyebrow mb-2">Notes</div>
            {client.notes ? (
              <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{client.notes}</p>
            ) : (
              <p className="m-0 text-[13px] text-fg-3">No notes yet.</p>
            )}
          </section>
        </div>

        {/* Main: projects */}
        <section className="panel rise rise-1 min-w-0 p-5 lg:order-1 lg:col-span-2">
          <div className="mb-3 flex items-baseline gap-2 border-b border-line pb-2">
            <FolderOutlined className="text-fg" />
            <h2 className="m-0 font-display text-[15px] font-bold tracking-tight text-fg">Projects</h2>
            <span className="mono text-[11px] text-fg-3">{String(list.length).padStart(2, '0')}</span>
            {canManageProjects && (
              <Button size="small" icon={<PlusOutlined />} className="ml-auto" onClick={() => setProjectOpen(true)}>New project</Button>
            )}
          </div>
          {projects === null ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : list.length === 0 ? (
            <MonoEmpty description="No projects for this client yet">
              {canManageProjects && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setProjectOpen(true)}>Start a project</Button>
              )}
            </MonoEmpty>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {list.map((p) => <ProjectCard key={p.id} project={p} showClient={false} />)}
            </div>
          )}
        </section>
      </div>

      {canManage && (
        <ClientFormModal open={editOpen} initial={client} onCancel={() => setEditOpen(false)} onSubmit={handleEdit} />
      )}
      {canManageProjects && (
        <ProjectFormModal
          open={projectOpen}
          initial={{ clientId: client.id, client: { id: client.id, name: client.name } }}
          onCancel={() => setProjectOpen(false)}
          onSubmit={handleCreateProject}
        />
      )}
    </div>
  );
}
