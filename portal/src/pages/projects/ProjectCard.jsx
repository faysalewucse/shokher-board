import { Link, useNavigate } from 'react-router';
import { ProjectOutlined } from '@ant-design/icons';
import { DeadlineBadge, OwnerAvatar, ProjectProgress, ProjectStatusTag } from './ProjectBits';

/** Project card for the projects grid and the client page. */
export default function ProjectCard({ project, showClient = true }) {
  const navigate = useNavigate();
  const open = () => navigate(`/projects/${project.id}`);
  const boards = project.boardCount ?? 0;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
      className="lift flex min-h-[176px] flex-col rounded-md border border-line bg-surface p-4"
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between gap-2">
        <ProjectStatusTag status={project.status} />
        <OwnerAvatar user={project.owner} size={24} />
      </div>

      <div className="mt-2.5 min-w-0">
        <div className="line-clamp-2 font-display text-[16px] font-bold leading-snug tracking-tight text-fg">{project.name}</div>
        {showClient && (
          <div className="mono mt-1 truncate text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
            {project.client ? (
              <Link
                to={`/clients/${project.client.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-fg-3! hover:text-fg! hover:underline"
              >
                {project.client.name}
              </Link>
            ) : 'Internal'}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DeadlineBadge deadline={project.deadline} status={project.status} empty={<span className="meta-badge">No deadline</span>} />
        <span className="meta-badge">
          <ProjectOutlined />
          <span className="tnum">{boards} {boards === 1 ? 'board' : 'boards'}</span>
        </span>
      </div>

      <div className="mt-auto pt-4">
        <ProjectProgress progress={project.progress} compact />
      </div>
    </div>
  );
}
