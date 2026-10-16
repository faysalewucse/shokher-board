import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { App } from "antd";
import { AuthProvider } from "@/context/AuthContext";
import ThemeProvider from "@/theme/ThemeProvider";
import router from "@/routes";
import "./index.css";

// The antd theme (tokens + component overrides) lives in src/theme/tokens.js;
// the matching CSS variables live in src/index.css.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <App>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </App>
    </ThemeProvider>
  </StrictMode>,
);
