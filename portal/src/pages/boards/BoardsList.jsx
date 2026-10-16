import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Input, Skeleton, message } from 'antd';
import MonoEmpty from '@/components/MonoEmpty';
import MonoTag from '@/components/MonoTag';
import { PlusOutlined, ProjectOutlined, SearchOutlined, FolderOutlined, AppstoreOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import usePermission from '@/hooks/usePermission';
import { getBoards, createBoard, errorMessage } from '@/services/boards';
import { boardSurfaceClass, DEFAULT_BOARD_COLOR } from './boardUtils';
import BoardFormModal from './BoardFormModal';

const ROLE_VARIANT = { owner: 'solid', member: 'outline', viewer: 'dashed' };

function BoardTile({ board, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-32 w-full flex-col overflow-hidden rounded-md border border-line bg-surface p-0 text-left transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-fg hover:shadow-[3px_3px_0_0_var(--c-fg)]"
      style={{ cursor: 'pointer' }}
    >
      {/* Grayscale tone + pattern derived from the stored board colour */}
      <div className={`relative h-14 w-full shrink-0 ${boardSurfaceClass(board.color || DEFAULT_BOARD_COLOR)}`}>
        {board.myRole && (
          <span className="absolute right-2 top-2">
            <MonoTag variant={ROLE_VARIANT[board.myRole] || 'soft'} style={board.myRole === 'owner' ? undefined : { background: 'var(--c-surface)' }}>
              {board.myRole}
            </MonoTag>
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between px-3 py-2">
        <div className="min-w-0">
          <div className="line-clamp-1 font-display text-[14px] font-bold leading-snug tracking-tight text-fg">{board.name}</div>
          {board.description && (
            <div className="line-clamp-1 text-[11.5px] text-fg-3">{board.description}</div>
          )}
        </div>
        <span className="mono truncate text-[10px] uppercase tracking-[0.1em] text-fg-3">
          {board.project?.client?.name ? `${board.project.client.name}` : '\u00a0'}
        </span>
      </div>
    </button>
  );
}

function Group({ icon, title, subtitle, boards, onOpen, children }) {
  return (
    <section className="mb-7 last:mb-0">
      <div className="mb-3 flex items-baseline gap-2 border-b border-line pb-2">
        <span className="text-fg">{icon}</span>
        <h2 className="m-0 font-display text-[15px] font-bold tracking-tight text-fg">{title}</h2>
        <span className="mono text-[11px] text-fg-3">{String(boards.length).padStart(2, '0')}</span>
        {subtitle && <span className="ml-auto truncate text-[12px] text-fg-3">{subtitle}</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boards.map((b) => <BoardTile key={b.id} board={b} onClick={() => onOpen(b.id)} />)}
        {children}
      </div>
    </section>
  );
}

export default function BoardsList() {
  const navigate = useNavigate();
  const canCreate = usePermission('BOARD_CREATE');
  const [boards, setBoards] = useState(null);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBoards()
      .then((data) => !cancelled && setBoards(data || []))
      .catch((err) => {
        if (cancelled) return;
        setBoards([]);
        message.error(errorMessage(err, 'Failed to load boards'));
      });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = (boards || []).filter((b) => !b.archivedAt).filter((b) => !q || [
      b.name, b.description, b.project?.name, b.project?.client?.name,
    ].some((s) => s?.toLowerCase().includes(q)));
    const standalone = visible.filter((b) => !b.projectId);
    const byProject = new Map();
    visible.filter((b) => b.projectId).forEach((b) => {
      if (!byProject.has(b.projectId)) byProject.set(b.projectId, { project: b.project, boards: [] });
      byProject.get(b.projectId).boards.push(b);
    });
    const projects = [...byProject.values()].sort((a, b) =>
      `${a.project?.client?.name || ''}${a.project?.name || ''}`.localeCompare(`${b.project?.client?.name || ''}${b.project?.name || ''}`));
    return { standalone, projects, total: visible.length };
  }, [boards, query]);

  const handleCreate = async (values) => {
    try {
      const board = await createBoard(values);
      setCreateOpen(false);
      message.success('Board created');
      if (board?.id) navigate(`/boards/${board.id}`);
    } catch (err) {
      message.error(errorMessage(err, 'Failed to create board'));
      throw err;
    }
  };

  const createTile = canCreate && (
    <button
      type="button"
      onClick={() => setCreateOpen(true)}
      className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-2 bg-transparent text-[13px] font-semibold text-fg-2 transition-colors duration-200 hover:border-fg hover:bg-surface hover:text-fg"
      style={{ cursor: 'pointer' }}
    >
      <PlusOutlined /> Create new board
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Boards"
        icon={<ProjectOutlined />}
        count={boards ? groups.total : null}
        subtitle="Kanban boards for your team, projects and clients"
        actions={(
          <>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-fg-3" />}
              placeholder="Search boards"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 220 }}
              className="hidden sm:flex"
            />
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New board</Button>
            )}
          </>
        )}
      />

      <div className="panel rise rise-1 p-5">
        {boards === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-32 flex-col overflow-hidden rounded-md border border-line">
                <div className="h-14 bg-surface-3" />
                <div className="px-3 py-2"><Skeleton active title={{ width: '70%' }} paragraph={{ rows: 1, width: '40%' }} /></div>
              </div>
            ))}
          </div>
        ) : groups.total === 0 && !query ? (
          <MonoEmpty description="No boards yet">
            {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create your first board</Button>}
          </MonoEmpty>
        ) : groups.total === 0 ? (
          <MonoEmpty description="No boards match your search" />
        ) : (
          <>
            {(groups.standalone.length > 0 || canCreate) && (
              <Group
                icon={<AppstoreOutlined />}
                title="Standalone"
                subtitle="Internal boards not tied to a project"
                boards={groups.standalone}
                onOpen={(id) => navigate(`/boards/${id}`)}
              >
                {!query && createTile}
              </Group>
            )}
            {groups.projects.map(({ project, boards: list }) => (
              <Group
                key={project?.id || list[0].projectId}
                icon={<FolderOutlined />}
                title={project?.name || 'Project'}
                subtitle={project?.client?.name ? `Client: ${project.client.name}` : null}
                boards={list}
                onOpen={(id) => navigate(`/boards/${id}`)}
              />
            ))}
          </>
        )}
      </div>

      <BoardFormModal open={createOpen} onCancel={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
