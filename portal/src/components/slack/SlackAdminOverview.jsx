import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { App, Avatar, Button, Card, Divider, Empty, Popconfirm, Skeleton, Table, Tooltip } from "antd";
import { CheckOutlined, DeleteOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import api from "@/services/api";
import usePermission from "@/hooks/usePermission";
import SlackMark from "./SlackMark";

dayjs.extend(relativeTime);

/** Settings → Integrations (admins): server setup status + every user's Slack connection. */
export default function SlackAdminOverview() {
  const canUpdate = usePermission("SETTINGS_UPDATE");
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return api
      .get("/integrations/slack/admin")
      .then((res) => setData(res.data.data))
      .catch((err) => message.error(err.response?.data?.message || "Failed to load Slack overview"))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const remove = async (row) => {
    setRemoving(row.id);
    try {
      await api.delete(`/integrations/slack/admin/connections/${row.id}`);
      message.success(`Removed ${row.user?.name || "user"}'s Slack connection`);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not remove connection");
    } finally {
      setRemoving(null);
    }
  };

  const rows = (data?.workspaces || []).flatMap((w) =>
    w.connections.map((c) => ({ ...c, workspace: w, key: c.id })),
  );

  const columns = [
    {
      title: "User",
      key: "user",
      render: (_, r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-fg">{r.user?.name || "—"}</div>
          <div className="truncate text-[12px] text-fg-3">{r.user?.email}</div>
        </div>
      ),
    },
    {
      title: "Slack workspace",
      key: "workspace",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Avatar shape="square" size={24} src={r.workspace.icon} style={{ background: "var(--c-surface-3)", color: "var(--c-fg)", fontSize: 11, fontWeight: 800 }}>
            {r.workspace.name?.[0]}
          </Avatar>
          <span className="truncate">{r.workspace.name}</span>
        </div>
      ),
    },
    {
      title: "Slack user",
      key: "slackUser",
      render: (_, r) => <span className="mono text-[12px]">{r.slackUser?.name ? `@${r.slackUser.name}` : r.slackUser?.id}</span>,
    },
    {
      title: "Connected",
      key: "connectedAt",
      render: (_, r) => (
        <Tooltip title={dayjs(r.connectedAt).format("D MMM YYYY, h:mm A")}>
          <span className="text-fg-2">{dayjs(r.connectedAt).fromNow()}</span>
        </Tooltip>
      ),
    },
    ...(canUpdate
      ? [{
          title: "",
          key: "actions",
          align: "right",
          render: (_, r) => (
            <Popconfirm
              title="Remove this Slack connection?"
              description="The user can connect again from their profile."
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(r)}
            >
              <Button size="small" icon={<DeleteOutlined />} loading={removing === r.id} aria-label="Remove connection" />
            </Popconfirm>
          ),
        }]
      : []),
  ];

  return (
    <Card className="rise" style={{ borderRadius: 6, maxWidth: 960 }} styles={{ body: { padding: "20px 24px" } }}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px]" style={{ background: "var(--c-inv)", color: "var(--c-on-inv)" }}>
          <SlackMark />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[16px] font-extrabold tracking-tight text-fg">Slack</span>
            {!loading && data && (
              data.configured
                ? <span className="mono-tag mono-tag--solid"><CheckOutlined /> Ready</span>
                : <span className="mono-tag mono-tag--dashed"><WarningOutlined /> Setup needed</span>
            )}
          </div>
          <p className="m-0 mt-1 text-[13px] text-fg-3">
            Each person connects their own Slack workspace from their{" "}
            <Link to="/profile#connected-apps" className="text-fg! underline underline-offset-2">profile</Link>.
            Here you can see every connection.
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label="Refresh" />
      </div>

      <Divider style={{ margin: "18px 0" }} />

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : !data ? null : (
        <>
          {!data.configured && (
            <div className="mb-5 rounded-md border border-dashed border-line-2 p-4 text-[13px] text-fg-2">
              <div className="mb-2 font-semibold text-fg">The server isn&apos;t set up for Slack yet</div>
              <p className="m-0 mb-2">
                Create a Slack app, then add these to <span className="mono">server/.env</span> and restart the server:
              </p>
              <ul className="m-0 mb-3 list-none p-0">
                {data.missing.map((k) => (
                  <li key={k} className="mono py-0.5 text-[12px] text-fg"><WarningOutlined className="mr-1.5" />{k}</li>
                ))}
              </ul>
              <p className="m-0 text-fg-3">
                The Redirect URL must be HTTPS, e.g.{" "}
                <span className="mono">https://&lt;your-api-domain&gt;/api/v1/integrations/slack/callback</span>.
                Full steps are in <span className="mono">server/docs/slack.md</span>.
              </p>
            </div>
          )}

          <div className="mb-3 flex items-baseline justify-between">
            <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">Connections</span>
            <span className="mono text-[11px] text-fg-3">
              {data.totalConnections} user{data.totalConnections === 1 ? "" : "s"} · {data.workspaces.length} workspace{data.workspaces.length === 1 ? "" : "s"}
            </span>
          </div>
          <Table
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={rows.length > 10 ? { pageSize: 10 } : false}
            scroll={{ x: 640 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nobody has connected Slack yet" /> }}
          />
        </>
      )}
    </Card>
  );
}
