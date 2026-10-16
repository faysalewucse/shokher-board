import { useNavigate, useLocation } from 'react-router';
import { Button } from 'antd';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { MonoArt } from '@/components/MonoEmpty';

const isDev = import.meta.env.MODE === 'development';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  const goHome = () => navigate('/', { replace: true });

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="rise w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex justify-center text-fg">
          <MonoArt kind="404" size={150} />
        </div>
        <div className="eyebrow mb-2">Error · 404</div>
        <h1 className="m-0 font-display text-[64px] font-black leading-none tracking-[-0.05em] text-fg sm:text-[88px]" style={{ fontStretch: '115%' }}>
          Lost.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[14px] text-fg-2">
          Sorry, the page you visited does not exist — it may have moved, or the link is wrong.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Go back</Button>
          <Button type="primary" icon={<HomeOutlined />} onClick={goHome}>
            Back Home
          </Button>
        </div>

        {isDev && (
          <div className="mx-auto mt-8 max-w-md rounded-md border border-dashed border-fg p-4 text-left">
            <p className="eyebrow mb-2 text-fg!">Development info</p>
            <p className="mono m-0 break-all text-xs text-fg">
              Path: {location.pathname}
            </p>
            {location.search && (
              <p className="mono m-0 mt-1 break-all text-xs text-fg">
                Search: {location.search}
              </p>
            )}
            {location.hash && (
              <p className="mono m-0 mt-1 break-all text-xs text-fg">
                Hash: {location.hash}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
