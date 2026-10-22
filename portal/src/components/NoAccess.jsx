import { MonoArt } from '@/components/MonoEmpty';

/** Friendly "no permission" panel (used when a read endpoint returns 403). */
export default function NoAccess({ children = 'You do not have permission to view this page.', hint }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-fg-2">
      <MonoArt kind="403" size={96} />
      <span className="font-semibold text-fg">{children}</span>
      {hint && <span className="max-w-sm text-[12.5px] text-fg-3">{hint}</span>}
    </div>
  );
}
