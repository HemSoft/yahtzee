import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { App } from "./App";

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) throw new Error("Missing VITE_CONVEX_URL environment variable");
const convex = new ConvexReactClient(url);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
