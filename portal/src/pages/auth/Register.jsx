import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Form, Input, Button, App } from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "./AuthLayout";
import CodeInput from "./CodeInput";

const RESEND_COOLDOWN = 60; // seconds

/**
 * Self sign-up in two steps:
 *   1. details → POST /auth/register (server emails a 6-digit code)
 *   2. code    → POST /auth/verify-email, then sign in automatically
 * `/register?verify=<email>` opens step 2 directly (e.g. from the login page
 * when an unverified account tries to sign in).
 */
export default function Register() {
  const [searchParams] = useSearchParams();
  const verifyEmailParam = searchParams.get("verify");

  const [step, setStep] = useState(verifyEmailParam ? "verify" : "details");
  const [email, setEmail] = useState(verifyEmailParam || "");
  const [password, setPassword] = useState(null); // kept in memory only, for auto sign-in
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [codeError, setCodeError] = useState(false);
  const [verifyForm] = Form.useForm();

  const { login } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();

  useEffect(() => {
    api.get("/config/public")
      .then((res) => setRegistrationEnabled(res.data?.data?.registrationEnabled !== false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onRegister = async (values) => {
    setLoading(true);
    try {
      await api.post("/auth/register", {
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
      });
      setEmail(values.email);
      setPassword(values.password);
      setStep("verify");
      setCooldown(RESEND_COOLDOWN);
      message.success("We sent a 6-digit code to your email");
    } catch (err) {
      message.error(err.response?.data?.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async ({ otp }) => {
    if (loading) return;
    setLoading(true);
    setCodeError(false);
    try {
      await api.post("/auth/verify-email", { email, otp });
      if (password) {
        await login(email, password);
        message.success("Account verified — welcome!");
        navigate("/", { replace: true });
      } else {
        message.success("Email verified — please sign in");
        navigate("/login", { replace: true });
      }
    } catch (err) {
      setCodeError(true);
      verifyForm.setFieldValue("otp", "");
      message.error(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await api.post("/auth/resend-verification", { email });
      setCooldown(RESEND_COOLDOWN);
      message.success("A new code is on its way");
    } catch (err) {
      message.error(err.response?.data?.message || "Could not resend code");
    }
  };

  if (step === "verify") {
    return (
      <AuthLayout>
        <div className="eyebrow mb-3">Step 2 of 2</div>
        <h1 className="m-0 mb-2 font-display text-[36px] font-extrabold leading-none tracking-[-0.035em] text-fg">
          Check your email
        </h1>
        <p className="mb-9 text-[14px] text-fg-3">
          Enter the 6-digit code we sent to <b className="text-fg">{email}</b>. It expires in 10 minutes.
        </p>

        <Form form={verifyForm} layout="vertical" onFinish={onVerify} requiredMark={false} className="[&_.ant-form-item]:mb-6">
          <Form.Item
            name="otp"
            label="Verification code"
            validateTrigger="onSubmit"
            rules={[{ required: true, len: 6, message: "Enter all 6 digits" }]}
          >
            <CodeInput
              autoFocus
              disabled={loading}
              status={codeError ? "error" : undefined}
              onComplete={() => verifyForm.submit()}
            />
          </Form.Item>

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
            Verify &amp; continue
          </Button>
        </Form>

        <div className="mt-6 flex items-center justify-between text-[13px]">
          <button
            type="button"
            onClick={() => setStep("details")}
            className="inline-flex items-center gap-1.5 text-fg-2 hover:text-fg"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <ArrowLeftOutlined /> Change email
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0}
            className="font-semibold text-fg underline underline-offset-2 disabled:font-normal disabled:text-fg-3 disabled:no-underline"
            style={{ background: "none", border: "none", cursor: cooldown > 0 ? "default" : "pointer", padding: 0 }}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="eyebrow mb-3">Create account</div>
      <h1 className="m-0 mb-2 font-display text-[36px] font-extrabold leading-none tracking-[-0.035em] text-fg">
        Join your team
      </h1>
      <p className="mb-9 text-[14px] text-fg-3">
        Sign up to start working on boards with your team
      </p>

      {!registrationEnabled ? (
        <div className="rounded-md border border-dashed border-line-2 p-4 text-[14px] text-fg-2">
          New sign-ups are turned off right now. Ask an administrator to create an account for you.
        </div>
      ) : (
        <Form
          layout="vertical"
          onFinish={onRegister}
          autoComplete="off"
          requiredMark={false}
          initialValues={{ email }}
          className="[&_.ant-form-item]:mb-5"
        >
          <Form.Item
            label="Full name"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "Please enter your name" },
              { min: 2, max: 50, message: "Name must be 2–50 characters" },
            ]}
          >
            <Input size="large" prefix={<UserOutlined className="mr-1.5 text-fg-3" />} placeholder="Your name" />
          </Form.Item>

          <Form.Item
            label="Email address"
            name="email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Please enter a valid email" },
            ]}
          >
            <Input size="large" prefix={<MailOutlined className="mr-1.5 text-fg-3" />} placeholder="you@example.com" />
          </Form.Item>

          <Form.Item
            label={<span>Phone <span className="text-fg-3">(optional)</span></span>}
            name="phone"
            rules={[{ pattern: /^[0-9+\-()\s]*$/, message: "Digits, spaces, +, -, ( and ) only" }]}
          >
            <Input size="large" prefix={<PhoneOutlined className="mr-1.5 text-fg-3" />} placeholder="+880 1XXX-XXXXXX" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: "Please choose a password" },
              { min: 6, message: "At least 6 characters" },
            ]}
            hasFeedback
          >
            <Input.Password size="large" prefix={<LockOutlined className="mr-1.5 text-fg-3" />} placeholder="At least 6 characters" />
          </Form.Item>

          <Form.Item
            label="Confirm password"
            name="confirm"
            dependencies={["password"]}
            hasFeedback
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Passwords do not match")),
              }),
            ]}
          >
            <Input.Password size="large" prefix={<LockOutlined className="mr-1.5 text-fg-3" />} placeholder="Repeat your password" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
            icon={<ArrowRightOutlined />}
            iconPlacement="end"
            className="mt-2 h-12! text-[15px]!"
          >
            Create account
          </Button>
        </Form>
      )}

      <p className="mt-7 text-center text-[13px] text-fg-3">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-fg! underline underline-offset-2 hover:text-fg-2!">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
