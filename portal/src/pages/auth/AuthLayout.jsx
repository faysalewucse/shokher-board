/** Split auth screen: typographic hero on black (desktop) + form column. */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left side — typographic hero on black */}
      <div className="grid-backdrop relative hidden overflow-hidden text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          {/* Brand mark placeholder — swap for your logo. */}
          <div className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-white font-display text-xl font-black text-black" style={{ fontStretch: '125%' }}>
            S
          </div>
          <span className="mono text-[11px] uppercase tracking-[0.16em] text-white/60">
            ShokherBoard · v{__APP_VERSION__}
          </span>
        </div>

        <div className="rise">
          <h1 className="m-0 font-display text-[88px] font-black leading-[0.86] tracking-[-0.055em] text-white xl:text-[112px]" style={{ fontStretch: '118%' }}>
            Shokher<br />Board<span className="text-white/35">.</span>
          </h1>
          <p className="mt-6 max-w-sm text-[17px] leading-snug text-white/70">
            Boards for your team, projects and clients — drag cards, or just send a message and it becomes one.
          </p>
        </div>

        <div className="mono flex items-center gap-6 text-[10.5px] uppercase tracking-[0.16em] text-white/45">
          <span>Clients</span><span>Projects</span><span>Boards</span><span>Messages</span>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex w-full items-center justify-center bg-surface px-6 py-10 lg:w-1/2">
        <div className="rise rise-1 w-full max-w-100">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-inv font-display font-black text-on-inv">
              S
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight text-fg">ShokherBoard</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
