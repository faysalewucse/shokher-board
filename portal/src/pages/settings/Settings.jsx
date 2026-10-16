import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Form,
  Input,
  Switch,
  Button,
  message,
  Card,
  Divider,
  Row,
  Col,
  Spin,
  Select,
  Tabs,
  ConfigProvider,
} from "antd";
import {
  SaveOutlined,
  SettingOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import api from "@/services/api";
import usePermission from "@/hooks/usePermission";
import PageHeader from "@/components/PageHeader";
import SlackAdminOverview from "@/components/slack/SlackAdminOverview";

// ── Section card ──────────────────────────────────────────────────────────────
const SectionCard = ({ icon, title, subtitle, children }) => (
  <Card
    className="rise"
    style={{ height: "100%", borderRadius: 6, display: "flex", flexDirection: "column" }}
    styles={{ body: { padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column" } }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 4,
          background: "var(--c-inv)",
          color: "var(--c-on-inv)",
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div className="font-display" style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em", color: "var(--c-fg)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--c-fg-3)" }}>{subtitle}</div>}
      </div>
    </div>
    <Divider style={{ margin: "0 0 20px" }} />
    {children}
  </Card>
);

// ── Save button ───────────────────────────────────────────────────────────────
const SaveBtn = ({ onClick, loading, canUpdate }) =>
  canUpdate ? (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto", paddingTop: 16 }}>
      <Button type="primary" icon={<SaveOutlined />} onClick={onClick} loading={loading}>
        Save
      </Button>
    </div>
  ) : null;

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const canUpdate = usePermission("SETTINGS_UPDATE");

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "integrations" ? "integrations" : "general";


  useEffect(() => {
    api
      .get("/config")
      .then(({ data }) => {
        const c = data.data || {};
        form.setFieldsValue({
          supportEmail: c.supportEmail || "",
          supportNumbers: c.supportNumbers || [],
          maintenanceMode: !!c.maintenanceMode,
          maintenanceMessage: c.maintenanceMessage || "",
          registrationEnabled: !!c.registrationEnabled,
        });
      })
      .catch(() => message.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [form]);

  const save = async (section, fields) => {
    try {
      const values = await form.validateFields(fields);
      setSaving((s) => ({ ...s, [section]: true }));
      await api.patch("/config", values);
      message.success("Saved successfully");
    } catch (err) {
      if (err?.errorFields) return; // validation error already shown by form
      message.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving((s) => ({ ...s, [section]: false }));
    }
  };

  const general = (
    <Form form={form} layout="vertical" disabled={!canUpdate} component={false}>
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={12}>
          <SectionCard
            icon={<MailOutlined />}
            title="Support & Contact"
            subtitle="Public contact details"
          >
            <Form.Item
              name="supportEmail"
              label="Support Email"
              rules={[{ type: "email", message: "Enter a valid email" }]}
            >
              <Input
                placeholder="support@example.com"
                prefix={<MailOutlined style={{ color: "var(--c-fg-3)" }} />}
              />
            </Form.Item>
            <Form.Item
              name="supportNumbers"
              label="Support Phone Numbers"
              extra="Type a number and press Enter to add. Multiple numbers allowed."
              rules={[
                {
                  validator: (_, values) =>
                    !values || values.every((v) => /^[0-9+\-()\s]+$/.test(v))
                      ? Promise.resolve()
                      : Promise.reject(new Error("Phone numbers may contain digits, spaces, +, - and () only")),
                },
              ]}
            >
              <Select
                mode="tags"
                placeholder="+1 555 000 0000"
                tokenSeparators={[","]}
                style={{ width: "100%" }}
                suffixIcon={<PhoneOutlined />}
              />
            </Form.Item>
            <SaveBtn
              canUpdate={canUpdate}
              loading={saving.contact}
              onClick={() => save("contact", ["supportEmail", "supportNumbers"])}
            />
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard
            icon={<SettingOutlined />}
            title="System"
            subtitle="Maintenance mode and registration controls"
          >
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item name="maintenanceMode" label="Maintenance Mode" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="registrationEnabled" label="Allow New Registrations" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="maintenanceMessage" label="Maintenance Message">
              <Input.TextArea rows={2} placeholder="We're down for maintenance. Be back shortly." />
            </Form.Item>
            <SaveBtn
              canUpdate={canUpdate}
              loading={saving.system}
              onClick={() =>
                save("system", ["maintenanceMode", "maintenanceMessage", "registrationEnabled"])
              }
            />
          </SectionCard>
        </Col>
      </Row>
    </Form>
  );

  return (
    <ConfigProvider
      theme={{
        components: {
          Form: { labelFontSize: 13 },
        },
      }}
    >
      <PageHeader title="Settings" icon={<SettingOutlined />} subtitle="Application configuration" />
      <Spin spinning={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams(key === "general" ? {} : { tab: key }, { replace: true })}
          items={[
            { key: "general", label: "General", children: general },
            { key: "integrations", label: "Integrations", children: <SlackAdminOverview /> },
          ]}
        />
      </Spin>
    </ConfigProvider>
  );
}
