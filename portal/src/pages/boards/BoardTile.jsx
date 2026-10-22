import MonoTag from '@/components/MonoTag';
import { boardSurfaceClass, DEFAULT_BOARD_COLOR } from './boardUtils';

const ROLE_VARIANT = { owner: 'solid', member: 'outline', viewer: 'dashed' };

/**
 * Board tile used on the boards list and project pages: monochrome backdrop
 * strip, the viewer's role, name, description and a small caption
 * (defaults to the client name).
 */
export default function BoardTile({ board, onClick, caption }) {
  const footer = caption !== undefined ? caption : board.project?.client?.name;
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
          {footer || ' '}
        </span>
      </div>
    </button>
  );
}

/** Dashed "create" tile matching BoardTile's footprint. */
export function CreateBoardTile({ onClick, children = 'Create new board', icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-2 bg-transparent text-[13px] font-semibold text-fg-2 transition-colors duration-200 hover:border-fg hover:bg-surface hover:text-fg"
      style={{ cursor: 'pointer' }}
    >
      {icon}
      {children}
    </button>
  );
}
