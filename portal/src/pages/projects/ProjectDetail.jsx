import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Dropdown, Modal, Skeleton, message } from 'antd';
import {
  FolderOutlined, EditOutlined, InboxOutlined, PlusOutlined, RightOutlined, DownOutlined, CheckOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import MonoEmpty, { MonoArt } from '@/components/MonoEmpty';
import NoAccess from '@/components/NoAccess';
import usePermission from '@/hooks/usePermission';
import { createBoard, errorMessage } from '@/services/boards';
import { getProject, updateProject, archiveProject } from '@/services/projects';
import BoardTile, { CreateBoardTile } from '@/pages/boards/BoardTile';
import BoardFormModal from '@/pages/boards/BoardFormModal';
import ProjectFormModal from './ProjectFormModal';
import { DeadlineBadge, OwnerAvatar, ProjectProgress, ProjectStatusTag } from './ProjectBits';
import { PROJECT_STATUSES, deadlineStatus, formatDay, formatStamp } from './projectUtils';

function Detail({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="eyebrow shrink-0">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-fg">{children}</span>
    </div>
  );
}

const dash = <span className="text-fg-3">—</span>;

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canManage = usePermission('PROJECT_MANAGE');
  const canCreateBoard = usePermission('BOARD_CREATE');

  const [project, setProject] = useState(null);
  const [error, setError] = useState(null); // null | 403 | 404 | 'error'
  const [editOpen, setEditOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProject(id)
      .then((data) => { if (!cancelled) { setProject(data); setError(null); } })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        setError(status === 403 || status === 404 ? status : 'error');
        if (status !== 403 && status !== 404) message.error(errorMessage(err, 'Failed to load project'));
      });
    return () => { cancelled = true; };
  }, [id]);

  const patch = async (body, success = 'Project updated') => {
    const prev = project;
    setProject((p) => ({ ...p, ...body }));
    try {
      const updated = await updateProject(id, body);
      setProject((p) => ({ ...p, ...updated }));
      message.success(success);
    } catch (err) {
      setProject(prev);
      message.error(errorMessage(err, 'Failed to update project'));
      throw err;
    }
  };

  const archive = () => {
    Modal.confirm({
      title: `Archive “${project.name}”?`,
      content: 'The project will be hidden from project lists. Its boards are kept.',
      okText: 'Archive',
      okButtonProps: { danger: true, type: 'primary' },
      onOk: async () => {
        try {
          await archiveProject(id);
          message.success('Project archived');
          navigate('/projects');
        } catch (err) {
          message.error(errorMessage(err, 'Failed to archive project'));
        }
      },
    });
  };

  const handleCreateBoard = async (values) => {
    try {
      const board = await createBoard(values);
      setBoardOpen(false);
      message.success('Board created');
      if (board?.id) navigate(`/boards/${board.id}`);
    } catch (err) {
      message.error(errorMessage(err, 'Failed to create board'));
      throw err;
    }
  };

  if (error === 403) {
    return <NoAccess hint="Ask an admin for the Projects read permission.">You don’t have access to this project.</NoAccess>;
  }
  if (error === 404 || error === 'error') {
    return (
      <div className="panel flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-fg-2">
        <MonoArt kind={error === 404 ? '404' : 'error'} size={96} />
        <span className="font-semibold text-fg">{error === 404 ? 'Project not found' : 'Couldn’t load this project'}</span>
        <Button onClick={() => navigate('/projects')}>Back to projects</Button>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="panel p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>
    );
  }

  const boards = (project.boards || []).filter((b) => !b.archivedAt);
  const due = deadlineStatus(project.deadline, project.status);

  const statusControl = canManage ? (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [project.status],
        items: PROJECT_STATUSES.map((s) => ({
          key: s.value,
          label: (
            <span className="flex min-w-[150px] items-center justify-between gap-3">
              <ProjectStatusTag status={s.value} />
              {s.value === project.status && <CheckOutlined className="text-[11px]" />}
            </span>
          ),
        })),
        onClick: ({ key }) => key !== project.status && patch({ status: key }, 'Status updated').catch(() => {}),
      }}
    >
      <button
        type="button"
        aria-label="Change status"
        className="inline-flex items-center gap-1.5 rounded-sm border-0 bg-transparent p-0.5 transition-colors hover:bg-surface-3"
        style={{ cursor: 'pointer' }}
      >
        <ProjectStatusTag status={project.status} />
        <DownOutlined className="text-[9px] text-fg-3" />
      </button>
    </Dropdown>
  ) : <ProjectStatusTag status={project.status} />;

  return (
    <div>
      {/* Header */}
      <div className="panel rise mb-4 px-5 py-4">
        <div className="mono mb-2 flex items-center gap-1 truncate text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
          <Link to="/projects" className="text-fg-3! hover:text-fg! hover:underline">Projects</Link>
          {project.client && (
            <>
              <RightOutlined style={{ fontSize: 8 }} />
              <Link to={`/clients/${project.client.id}`} className="text-fg-3! hover:text-fg! hover:underline">{project.client.name}</Link>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-inv text-[18px] leading-none text-on-inv">
              <FolderOutlined />
            </span>
            <div className="min-w-0">
              <h1 className="m-0 font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-fg">{project.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {statusControl}
                <DeadlineBadge deadline={project.deadline} status={project.status} />
                {due && due.key !== 'later' && due.key !== 'done' && (
                  <span className="mono text-[10.5px] uppercase tracking-[0.08em] text-fg-2">{due.label}</span>
                )}
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>
              <Button danger icon={<InboxOutlined />} onClick={archive}>Archive</Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <section className="panel rise rise-1 p-5">
            <div className="mb-3 flex items-baseline gap-2 border-b border-line pb-2">
              <AppstoreOutlined className="text-fg" />
              <h2 className="m-0 font-display text-[15px] font-bold tracking-tight text-fg">Boards</h2>
              <span className="mono text-[11px] text-fg-3">{String(boards.length).padStart(2, '0')}</span>
              {canCreateBoard && (
                <Button size="small" icon={<PlusOutlined />} className="ml-auto" onClick={() => setBoardOpen(true)}>New board</Button>
              )}
            </div>
            {boards.length === 0 && !canCreateBoard ? (
              <MonoEmpty compact description="No boards you can see in this project yet" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {boards.map((b) => (
                  <BoardTile key={b.id} board={b} caption={b.updatedAt ? `Updated ${formatStamp(b.updatedAt)}` : ''} onClick={() => navigate(`/boards/${b.id}`)} />
                ))}
                {canCreateBoard && (
                  <CreateBoardTile icon={<PlusOutlined />} onClick={() => setBoardOpen(true)}>
                    {boards.length ? 'Add a board' : 'Create the first board'}
                  </CreateBoardTile>
                )}
              </div>
            )}
          </section>

          <section className="panel rise rise-2 p-5">
            <div className="eyebrow mb-2">Description</div>
            {project.description ? (
              <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg">{project.description}</p>
            ) : (
              <p className="m-0 text-[13px] text-fg-3">No description yet.</p>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel rise rise-1 p-5">
            <div className="eyebrow mb-3">Progress</div>
            <ProjectProgress progress={project.progress} />
          </section>

          <section className="panel rise rise-2 px-5 py-3">
            <Detail label="Client">
              {project.client ? (
                <Link to={`/clients/${project.client.id}`} className="font-semibold text-fg! hover:underline">{project.client.name}</Link>
              ) : <span className="text-fg-3">Internal</span>}
            </Detail>
            <Detail label="Owner"><OwnerAvatar user={project.owner} size={22} withName /></Detail>
            <Detail label="Start">{project.startDate ? <span className="mono text-[12px]">{formatDay(project.startDate)}</span> : dash}</Detail>
            <Detail label="Deadline">
              {project.deadline ? <DeadlineBadge deadline={project.deadline} status={project.status} /> : dash}
            </Detail>
            <Detail label="Boards"><span className="mono tnum text-[12px]">{project.boardCount ?? boards.length}</span></Detail>
            <Detail label="Created"><span className="mono text-[12px] text-fg-2">{formatStamp(project.createdAt)}</span></Detail>
          </section>
        </div>
      </div>

      {canManage && (
        <ProjectFormModal
          open={editOpen}
          initial={project}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            await patch(values);
            setEditOpen(false);
          }}
        />
      )}

      <BoardFormModal
        open={boardOpen}
        initial={{ projectId: project.id }}
        onCancel={() => setBoardOpen(false)}
        onSubmit={handleCreateBoard}
      />
    </div>
  );
}
