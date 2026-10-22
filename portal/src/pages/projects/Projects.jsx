import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Input, Segmented, Select, Skeleton, message } from 'antd';
import { FolderOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import MonoEmpty from '@/components/MonoEmpty';
import NoAccess from '@/components/NoAccess';
import usePermission from '@/hooks/usePermission';
import useDebounce from '@/hooks/useDebounce';
import { errorMessage } from '@/services/boards';
import { getClients, getProjects, createProject } from '@/services/projects';
import ProjectCard from './ProjectCard';
import ProjectFormModal from './ProjectFormModal';
import { PROJECT_STATUSES } from './projectUtils';

const GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

export default function Projects() {
  const navigate = useNavigate();
  const canRead = usePermission('PROJECT_READ');
  const canManage = usePermission('PROJECT_MANAGE');
  const [params, setParams] = useSearchParams();

  const clientId = params.get('client') || undefined;
  const status = params.get('status') || 'all';
  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const [projects, setProjects] = useState(null);
  const [denied, setDenied] = useState(false);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!canRead) return undefined;
    let cancelled = false;
    getProjects({ clientId, q: debouncedQuery || undefined })
      .then((data) => !cancelled && setProjects(data || []))
      .catch((err) => {
        if (cancelled) return;
        setProjects([]);
        if (err?.response?.status === 403) setDenied(true);
        else message.error(errorMessage(err, 'Failed to load projects'));
      });
    return () => { cancelled = true; };
  }, [canRead, clientId, debouncedQuery]);

  useEffect(() => {
    if (!canRead) return undefined;
    let cancelled = false;
    getClients()
      .then((data) => !cancelled && setClients(data || []))
      .catch(() => !cancelled && setClients([])); // no CLIENT_READ → no client filter options
    return () => { cancelled = true; };
  }, [canRead]);

  // Status is filtered locally so the segmented control can show counts.
  const counts = useMemo(() => {
    const c = { all: projects?.length || 0 };
    (projects || []).forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [projects]);
  const visible = useMemo(
    () => (projects || []).filter((p) => status === 'all' || p.status === status),
    [projects, status],
  );

  const handleCreate = async (values) => {
    try {
      const project = await createProject(values);
      setCreateOpen(false);
      message.success('Project created');
      if (project?.id) navigate(`/projects/${project.id}`);
    } catch (err) {
      message.error(errorMessage(err, 'Failed to create project'));
      throw err;
    }
  };

  if (!canRead || denied) {
    return <NoAccess hint="Ask an admin for the Projects read permission.">You don’t have access to projects.</NoAccess>;
  }

  const filtered = !!(clientId || debouncedQuery || status !== 'all');
  const segLabel = (label, key) => (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {projects && <span className="mono tnum text-[10.5px] opacity-70">{counts[key] || 0}</span>}
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Projects"
        icon={<FolderOutlined />}
        count={projects ? projects.length : null}
        subtitle="Client work and internal initiatives, with their boards and progress"
        actions={(
          <>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-fg-3" />}
              placeholder="Search projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 220 }}
            />
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New project</Button>
            )}
          </>
        )}
      />

      <div className="panel rise rise-1 mb-4 flex flex-wrap items-center gap-2.5 p-3">
        <Segmented
          value={status}
          onChange={(v) => setParam('status', v)}
          options={[
            { value: 'all', label: segLabel('All', 'all') },
            ...PROJECT_STATUSES.map((s) => ({ value: s.value, label: segLabel(s.label, s.value) })),
          ]}
        />
        <Select
          allowClear
          placeholder="All clients"
          value={clientId}
          onChange={(v) => setParam('client', v)}
          showSearch={{ optionFilterProp: 'label' }}
          style={{ width: 220 }}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
        {filtered && (
          <Button
            type="text"
            size="small"
            onClick={() => { setQuery(''); setParams(new URLSearchParams(), { replace: true }); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="rise rise-2">
        {projects === null ? (
          <div className={GRID}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="panel min-h-[176px] p-4">
                <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 3, width: ['40%', '70%', '100%'] }} />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="panel">
            {filtered ? (
              <MonoEmpty description="No projects match these filters" />
            ) : (
              <MonoEmpty description="No projects yet">
                {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create your first project</Button>}
              </MonoEmpty>
            )}
          </div>
        ) : (
          <div className={GRID}>
            {visible.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={createOpen}
        initial={clientId ? { clientId } : undefined}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
