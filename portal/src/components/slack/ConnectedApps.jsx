import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { App, Avatar, Button, Card, Empty, Popconfirm, Skeleton, Tooltip } from "antd";
import {
  ApiOutlined,
  DisconnectOutlined,
  ExportOutlined,
  PlusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import api from "@/services/api";
import SlackMark from "./SlackMark";
import { SLACK_ERROR_TEXT } from "./slackErrors";

dayjs.extend(relativeTime);

/** One connected Slack workspace for the current user. */
function ConnectionRow({ conn, busy, onTest, onDisconnect }) {
  const ws = conn.workspace || {};
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-3">
      <Avatar
        shape="square"
        size={40}
        src={ws.icon}
        style={{ background: "var(--c-surface-3)", color: "var(--c-fg)", fontWeight: 800, borderRadius: 6 }}
      >
        {ws.name?.[0]}
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-fg">
          {ws.name}
          {ws.url && (
            <a href={ws.url} target="_blank" rel="noreferrer" className="text-fg-3! hover:text-fg!" aria-label="Open workspace in Slack">
              <ExportOutlined style={{ fontSize: 11 }} />
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 truncate text-[12.5px] text-fg-3">
          {conn.slackUser?.avatar && <Avatar size={16} src={conn.slackUser.avatar} />}
          <span className="truncate">
            {conn.slackUser?.name ? `@${conn.slackUser.name}` : conn.slackUser?.id}
            {" · "}
            <Tooltip title={dayjs(conn.connectedAt).format("D MMM YYYY, h:mm A")}>
              connected {dayjs(conn.connectedAt).fromNow()}
            </Tooltip>
          </span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Button size="small" icon={<ApiOutlined />} loading={busy === `test:${conn.id}`} onClick={() => onTest(conn)}>
          Test
        </Button>
        <Popconfirm
          title={`Disconnect ${ws.name}?`}
          description="ShokherBoard will stop using your Slack account in this workspace."
          okText="Disconnect"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDisconnect(conn)}
        >
          <Button size="small" icon={<DisconnectOutlined />} loading={busy === `disconnect:${conn.id}`}>
            Disconnect
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
}

/**
 * "Connected apps" card for the profile page: every user can connect their
 * own Slack workspace(s) to their ShokherBoard account.
 */
export default function ConnectedApps() {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    return api
      .get("/integrations/slack")
      .then(({ data }) => setStatus(data.data))
      .catch((err) => message.error(err.response?.data?.message || "Failed to load Slack connections"))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => { load(); }, [load]);

  // Result of the Slack round-trip (?slack=connected|error&reason=…): show once, clean the URL.
  useEffect(() => {
    const result = searchParams.get("slack");
    if (!result) return;
    if (result === "connected") {
      message.success(`Slack connected${searchParams.get("team") ? ` — ${searchParams.get("team")}` : ""}`);
    } else {
      const reason = searchParams.get("reason");
      message.error(SLACK_ERROR_TEXT[reason] || `Slack connection failed${reason ? ` (${reason})` : ""}`, 6);
    }
    setSearchParams({}, { replace: true });
    document.getElementById("connected-apps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams, setSearchParams, message]);

  const connect = async () => {
    setBusy("connect");
    try {
      const { data } = await api.post("/integrations/slack/install");
      window.location.assign(data.data.url); // Slack approval page → back to /profile
    } catch (err) {
      message.error(err.response?.data?.message || "Could not start Slack connection");
      setBusy(null);
    }
  };

  const test = async (conn) => {
    setBusy(`test:${conn.id}`);
    try {
      const { data } = await api.post(`/integrations/slack/connections/${conn.id}/test`);
      const d = data.data;
      message.success(`Working — ${d.you?.name ? `you're @${d.you.name}` : "connected"} in ${d.team}`);
    } catch (err) {
      message.error(err.response?.data?.message || "Slack connection test failed");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (conn) => {
    setBusy(`disconnect:${conn.id}`);
    try {
      await api.delete(`/integrations/slack/connections/${conn.id}`);
      message.success(`Disconnected from ${conn.workspace?.name || "Slack"}`);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not disconnect Slack");
    } finally {
      setBusy(null);
    }
  };

  const connections = status?.connections || [];

  return (
    <Card
      id="connected-apps"
      className="rise rise-3"
      style={{ borderRadius: 6, scrollMarginTop: 80 }}
      styles={{ body: { padding: 24 } }}
      title="Connected apps"
    >
      <div className="mb-4 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px]"
          style={{ background: "var(--c-inv)", color: "var(--c-on-inv)" }}
        >
          <SlackMark />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-extrabold tracking-tight text-fg">Slack</div>
          <p className="m-0 text-[13px] text-fg-3">
            Connect your Slack workspace to your ShokherBoard account. You can connect more than one.
          </p>
        </div>
        {!loading && status?.configured && connections.length > 0 && (
          <Button icon={<PlusOutlined />} loading={busy === "connect"} onClick={connect}>
            Add workspace
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : connections.length > 0 ? (
        <div className="flex flex-col gap-2">
          {connections.map((conn) => (
            <ConnectionRow key={conn.id} conn={conn} busy={busy} onTest={test} onDisconnect={disconnect} />
          ))}
        </div>
      ) : !status?.configured ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-line-2 px-3 py-3 text-[13px] text-fg-2">
          <WarningOutlined />
          Slack isn&apos;t available yet — an administrator needs to finish setting it up on the server.
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span className="text-fg-3">No Slack workspace connected</span>}
          style={{ margin: "8px 0" }}
        >
          <Button type="primary" icon={<SlackMark size={14} />} loading={busy === "connect"} onClick={connect}>
            Connect Slack
          </Button>
        </Empty>
      )}
    </Card>
  );
}
