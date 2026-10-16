import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Form, Input, Button, App, Checkbox } from "antd";
import {
  MailOutlined,
  LockOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import AuthLayout from "./AuthLayout";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    api.get("/config/public")
      .then((res) => setRegistrationEnabled(res.data?.data?.registrationEnabled !== false))
      .catch(() => {});
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success("Login successful");
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed";
      // Unverified account: take them to the code-entry step.
      if (err.response?.status === 403 && /verify your email/i.test(msg)) {
        message.info("Please verify your email first");
        navigate(`/register?verify=${encodeURIComponent(values.email)}`);
        return;
      }
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
          <div className="eyebrow mb-3">Sign in</div>
          <h1 className="m-0 mb-2 font-display text-[36px] font-extrabold leading-none tracking-[-0.035em] text-fg">
            Welcome back
          </h1>
          <p className="mb-9 text-[14px] text-fg-3">
            Sign in to continue to your dashboard
          </p>

          <Form
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            requiredMark={false}
            className="[&_.ant-form-item]:mb-5"
          >
            <Form.Item
              label="Email address"
              name="email"
              rules={[
                { required: true, message: "Please enter your email" },
                { type: "email", message: "Please enter a valid email" },
              ]}
            >
              <Input
                size="large"
                prefix={<MailOutlined className="mr-1.5 text-fg-3" />}
                placeholder="you@example.com"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: "Please enter your password" },
              ]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="mr-1.5 text-fg-3" />}
                placeholder="Enter your password"
              />
            </Form.Item>

            <div className="mb-7 flex items-center justify-between">
              <Checkbox>
                <span className="text-[13px] text-fg-2">Remember me</span>
              </Checkbox>
              <a className="text-[13px] font-semibold text-fg! underline underline-offset-2 hover:text-fg-2!">
                Forgot password?
              </a>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              className="h-12! text-[15px]!"
            >
              Sign In
            </Button>
          </Form>

          {registrationEnabled && (
            <p className="mt-7 text-center text-[13px] text-fg-3">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="font-semibold text-fg! underline underline-offset-2 hover:text-fg-2!">
                Create one
              </Link>
            </p>
          )}
    </AuthLayout>
  );
}
