export default function PageHeader({ title, icon, actions, subtitle, count }) {
  return (
    <div className="panel rise mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-inv text-[18px] leading-none text-on-inv">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="m-0 font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-fg">
              {title}
            </h1>
            {count != null && (
              <span className="mono inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border border-fg px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-fg">
                <span className="tnum">{count}</span> total
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mb-0 mt-0.5 text-[13px] text-fg-3">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
