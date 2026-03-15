import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["storage", "activeTab", "tabs", "scripting"],
    host_permissions: ["<all_urls>"],
  },
  vite: ({ mode }) => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
    oxc: {
      jsx: {
        development: mode === "development",
      },
    },
  }),
});
