import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "antd/dist/reset.css";
import { router } from "./router";
import { shouldUseReactStrictMode } from "./react-strict-mode";
import "./styles/index.css";

const app = <RouterProvider router={router} />;

createRoot(document.getElementById("root")!).render(
  shouldUseReactStrictMode(import.meta.env.VITE_APP_REACT_STRICT_MODE) ? <React.StrictMode>{app}</React.StrictMode> : app
);
