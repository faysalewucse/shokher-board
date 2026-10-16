import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Layout, Menu, Dropdown, Avatar, Tooltip, ConfigProvider, theme, AutoComplete, Input } from 'antd';
import { useThemeMode } from '@/theme/themeMode';
import {
  DashboardOutlined,
  UserOutlined,
  SafetyOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  BellOutlined,
  SearchOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CaretDownOutlined,
  TeamOutlined,
  AuditOutlined,
  ProjectOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/utils/imageUrl';
import NotificationBell from '@/components/notifications/NotificationBell';
import { NotificationProvider } from '@/context/NotificationContext';
import { SocketProvider } from '@/context/SocketContext';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/boards', icon: <ProjectOutlined />, label: 'Boards' },
  // Clients / Projects go here (next step), e.g.:
  // { key: '/clients',  icon: <ContactsOutlined />, label: 'Clients',  permission: 'CLIENT_READ' },
  // { key: '/projects', icon: <FolderOutlined />,   label: 'Projects', permission: 'PROJECT_READ' },
  {
    key: 'user-management',
    icon: <TeamOutlined />,
    label: 'User Management',
    children: [
      { key: '/users', label: 'Users', permission: 'USER_READ_ANY', icon: <UserOutlined /> },
      { key: '/roles', label: 'Roles', permission: 'ROLE_READ',     icon: <SafetyOutlined /> },
    ],
  },
  { key: '/audit-logs',    icon: <AuditOutlined />,   label: 'Audit Logs',    permission: 'AUDIT_READ' },
  { key: '/notifications', icon: <BellOutlined />,    label: 'Notifications' },
  { key: '/settings',      icon: <SettingOutlined />, label: 'Settings',      permission: 'SETTINGS_READ' },
];

// Flat list of all navigable menu keys (paths starting with "/")
const ALL_MENU_KEYS = menuItems.flatMap((item) =>
  item.children ? item.children.map((c) => c.key) : [item.key]
).filter((k) => k.startsWith('/'));

// Flat, searchable feature list derived from the menu (label + path + permission).
// Adding menu items automatically makes them findable in the navbar search.
const FEATURE_LIST = menuItems.flatMap((item) => {
  const group = item.children ? item.label : null;
  const nodes = item.children || [item];
  return nodes.map((n) => ({
    label: n.label,
    key: n.key,
    group,
    permission: n.permission,
    alternatePermission: n.alternatePermission,
  }));
}).filter((f) => f.key && f.key.startsWith('/') && f.label);

// Walk up path segments to find the nearest matching menu key.
// e.g. /users/abc/edit → /users
const getSelectedKey = (pathname) => {
  if (ALL_MENU_KEYS.includes(pathname)) return pathname;
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 1; i--) {
    const candidate = '/' + segments.slice(0, i).join('/');
    if (ALL_MENU_KEYS.includes(candidate)) return candidate;
  }
  return pathname;
};

export default function AdminLayout() {
  const [collapsed, setCollapsed]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Restore saved submenu expanded state from localStorage.
  const [expandedKeys, setExpandedKeys] = useState(() => {
    try {
      const saved = localStorage.getItem('shokherboard.menuExpandedKeys');
      return saved ? JSON.parse(saved) : ['user-management'];
    } catch {
      return ['user-management'];
    }
  });
  const [featureQuery, setFeatureQuery] = useState('');
  const { user, logout, permissions } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { token } = theme.useToken();
  const { mode, toggle: toggleMode } = useThemeMode();

  // Navbar feature search — permission-filtered, matched against label/path.
  const featureOptions = FEATURE_LIST
    .filter((f) => !f.permission || permissions.includes(f.permission) ||
      (f.alternatePermission && permissions.includes(f.alternatePermission)))
    .filter((f) => {
      const q = featureQuery.trim().toLowerCase();
      if (!q) return true;
      return `${f.label} ${f.group || ''} ${f.key}`.toLowerCase().includes(q);
    })
    .map((f) => ({
      value: f.key,
      label: f.group ? `${f.label}  ·  ${f.group}` : f.label,
    }));

  // Save expanded state to localStorage
  const handleExpand = (keys) => {
    setExpandedKeys(keys);
    try { localStorage.setItem('shokherboard.menuExpandedKeys', JSON.stringify(keys)); } catch { /* ignore */ }
  };

  // Filter menu items based on permissions and handle submenus
  const visibleItems = menuItems
    .filter((item) => {
      // Always show parent items if they have children
      if (item.children) {
        // Filter children and only show parent if at least one child is visible
        const visibleChildren = item.children.filter(
          (child) => !child.permission || permissions.includes(child.permission) || (child.alternatePermission && permissions.includes(child.alternatePermission))
        );
        return visibleChildren.length > 0;
      }
      // Show item if no permission required or user has permission (or alternate permission)
      return !item.permission || permissions.includes(item.permission) || (item.alternatePermission && permissions.includes(item.alternatePermission));
    })
    .map((item) => {
      if (item.children) {
        // Filter children for submenus
        const visibleChildren = item.children.filter(
          (child) => !child.permission || permissions.includes(child.permission) || (child.alternatePermission && permissions.includes(child.alternatePermission))
        );
        return {
          key: item.key,
          icon: item.icon,
          label: collapsed
            ? <Tooltip title={item.label} placement="right">{item.label}</Tooltip>
            : <span style={{ fontWeight: 500, fontSize: token.fontSize }}>{item.label}</span>,
          children: visibleChildren.map((child) => ({
            key: child.key,
            icon: child.icon,
            label: <span style={{ fontWeight: 400, fontSize: token.fontSize }}>{child.label}</span>,
          })),
        };
      }
      return {
        key: item.key,
        icon: item.icon,
        label: collapsed
          ? <Tooltip title={item.label} placement="right">{item.label}</Tooltip>
          : <span style={{ fontWeight: 500, fontSize: token.fontSize }}>{item.label}</span>,
      };
    });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const dropdownItems = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'My Profile' },
      { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout')   logout();
      if (key === 'profile')  navigate('/profile');
      if (key === 'settings') navigate('/settings');
    },
  };

  return (
    <SocketProvider>
    <NotificationProvider>
      <Layout style={{ height: '100vh', background: 'var(--c-bg)' }}>

      {/* Sidebar — solid black, white type, white active block */}
      <Sider
        className="app-sider"
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        collapsedWidth={72}
        style={{
          background: 'var(--c-sidebar)',
          borderRight: '1px solid var(--c-sidebar-line)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Logo */}
          <div
            role="link"
            tabIndex={0}
            aria-label="Go to dashboard"
            onClick={() => navigate('/')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/')}
            className="group"
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 18px',
              borderBottom: '1px solid var(--c-sidebar-line)',
              gap: 12,
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            {/* Brand mark placeholder — swap for your logo. */}
            <div
              className="transition-transform duration-200 group-hover:-rotate-6"
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 3,
                background: 'var(--white)',
                color: 'var(--black)',
                fontFamily: 'var(--ff-display)',
                fontWeight: 900,
                fontSize: 18,
                fontStretch: '125%',
              }}
            >
              S
            </div>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 16, fontStretch: '112%', letterSpacing: '-0.02em', color: 'var(--white)', whiteSpace: 'nowrap' }}>
                  ShokherBoard
                </span>
                <span className="mono" style={{ fontWeight: 500, fontSize: 10, letterSpacing: '0.1em', color: 'var(--c-sidebar-muted)', whiteSpace: 'nowrap', marginTop: 4 }}>
                  V{__APP_VERSION__}
                </span>
              </div>
            )}
          </div>

          {/* Menu */}
          <div style={{ flex: 1, padding: '12px 8px', overflow: 'hidden auto' }}>
            {!collapsed && (
              <p className="mono" style={{ fontSize: 10, fontWeight: 500, color: 'var(--c-sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', padding: '2px 10px 8px', margin: 0 }}>
                Main Menu
              </p>
            )}
            <ConfigProvider
              theme={{
                components: {
                  Menu: {
                    itemHeight: 36,
                    itemMarginBlock: 2,
                    itemMarginInline: 2,
                    itemPaddingInline: 12,
                    iconMarginInlineEnd: 12,
                    iconSize: 15,
                    collapsedIconSize: 18,
                    itemBorderRadius: 3,
                    subMenuItemBorderRadius: 3,
                    // White-on-black
                    darkItemBg: 'transparent',
                    darkSubMenuItemBg: 'transparent',
                    darkPopupBg: '#0a0a0a',
                    darkItemColor: 'rgba(255,255,255,0.72)',
                    darkItemHoverColor: '#ffffff',
                    darkItemHoverBg: 'rgba(255,255,255,0.08)',
                    darkItemSelectedBg: '#ffffff',
                    darkItemSelectedColor: '#0a0a0a',
                    darkGroupTitleColor: 'rgba(255,255,255,0.56)',
                  },
                },
              }}
            >
              <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[getSelectedKey(location.pathname)]}
                expandedKeys={expandedKeys}
                onOpenChange={handleExpand}
                onClick={({ key }) => navigate(key)}
                inlineIndent={16}
                style={{
                  border: 'none',
                  background: 'transparent'
                }}
                items={visibleItems}
              />
            </ConfigProvider>
          </div>

        </div>
      </Sider>

      {/* Main area */}
      <Layout style={{ background: 'var(--c-bg)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          height: 64,
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <button
                type="button"
                className="icon-btn"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            </Tooltip>

            <div className="hidden md:block">
              <AutoComplete
                value={featureQuery}
                options={featureOptions}
                onSearch={setFeatureQuery}
                onChange={setFeatureQuery}
                onSelect={(key) => { setFeatureQuery(''); navigate(key); }}
                style={{ width: 320 }}
                allowClear
                filterOption={false}
                placeholder="Search features… (users, roles, settings)"
              >
                <Input prefix={<SearchOutlined style={{ color: 'var(--c-fg-3)', marginRight: 2 }} />} />
              </AutoComplete>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <button
                type="button"
                className="icon-btn"
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={mode === 'dark'}
                onClick={toggleMode}
              >
                {mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              </button>
            </Tooltip>

            <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <button
                type="button"
                className="icon-btn"
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={toggleFullscreen}
              >
                {fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              </button>
            </Tooltip>

            <NotificationBell />

            <div style={{ width: 1, height: 28, background: 'var(--c-line)', margin: '0 8px' }} />

            <Dropdown menu={dropdownItems} placement="bottomRight" trigger={['click']}>
              <button
                type="button"
                aria-label="Account menu"
                className="flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1 transition-colors duration-150 hover:border-line hover:bg-surface-2"
                style={{ cursor: 'pointer', background: 'transparent', textAlign: 'left' }}
              >
                <Avatar
                  src={user?.avatar ? getImageUrl(user.avatar) : undefined}
                  icon={<UserOutlined />}
                  shape="square"
                  style={{ backgroundColor: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', borderRadius: 4 }}
                  size={32}
                />
                <div style={{ lineHeight: 1.25 }} className="hidden sm:block">
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-fg)' }}>{user?.name}</div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-fg-3)' }}>{user?.role?.name || 'No role'}</div>
                </div>
                <CaretDownOutlined style={{ fontSize: 10, color: 'var(--c-fg-3)' }} />
              </button>
            </Dropdown>
          </div>
        </div>

        {/* Content — canvas; pages render their own surfaces.
            id lets pages scroll this region to the top (it scrolls, not window). */}
        <Content id="admin-content" style={{ padding: 24, overflow: 'auto', flex: 1, minHeight: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  </NotificationProvider>
  </SocketProvider>
  );
}
