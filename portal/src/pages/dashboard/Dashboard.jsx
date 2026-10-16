import { useNavigate } from "react-router";
import {
  DashboardOutlined,
  UserOutlined,
  SafetyOutlined,
  BellOutlined,
  AuditOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { useCountUpSimple } from "@/hooks/useCountUp";
import PageHeader from "@/components/PageHeader";

// Placeholder stat cards — values are static. Wire them to real endpoints
// (e.g. a /stats route on the server) once the app has data worth showing.
const STAT_CARDS = [
  {
    label: "Users",
    value: 0,
    permission: "USER_READ_ANY",
    path: "/users",
    icon: <UserOutlined />,
  },
  {
    label: "Roles",
    value: 0,
    permission: "ROLE_READ",
    path: "/roles",
    icon: <SafetyOutlined />,
  },
  {
    label: "Notifications",
    value: 0,
    path: "/notifications",
    icon: <BellOutlined />,
  },
  {
    label: "Audit Events",
    value: 0,
    permission: "AUDIT_READ",
    path: "/audit-logs",
    icon: <AuditOutlined />,
  },
];

function StatCard({ label, value, icon, path, navigate, index }) {
  const animated = useCountUpSimple(value, 1500, 0);
  const Tag = path ? "button" : "div";
  return (
    <Tag
      type={path ? "button" : undefined}
      onClick={() => path && navigate(path)}
      className={`lift rise rise-${Math.min(index + 1, 4)} group relative flex w-full flex-col overflow-hidden rounded-md border border-line bg-surface p-4 text-left ${path ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{String(index + 1).padStart(2, "0")} · {label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-line text-[15px] text-fg transition-colors duration-200 group-hover:border-inv group-hover:bg-inv group-hover:text-on-inv">
          {icon}
        </span>
      </div>
      <p className="m-0 mt-5 font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] text-fg tnum" style={{ fontStretch: "110%" }}>
        {animated.toLocaleString()}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <span className="text-[12px] font-medium text-fg-3">{path ? `Open ${label.toLowerCase()}` : label}</span>
        {path && <ArrowRightOutlined className="text-[12px] text-fg-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg" />}
      </div>
    </Tag>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();

  const cards = STAT_CARDS.filter((c) => !c.permission || permissions.includes(c.permission));

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(" ")[0] || "there"}`}
        icon={<DashboardOutlined />}
        subtitle="Welcome to ShokherBoard."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} index={i} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}
