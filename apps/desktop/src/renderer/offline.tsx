import React from "react";
import { createRoot } from "react-dom/client";
import { OfflineApp } from "./OfflineApp";

createRoot(document.getElementById("root")!).render(<React.StrictMode><OfflineApp /></React.StrictMode>);
