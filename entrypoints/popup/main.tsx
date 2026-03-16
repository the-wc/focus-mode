import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "@/assets/tailwind.css";

// Sync system color scheme preference to <html> class for CSS variable theming
const mq = window.matchMedia("(prefers-color-scheme: dark)");
function syncDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}
syncDark(mq.matches);
mq.addEventListener("change", (e) => syncDark(e.matches));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
