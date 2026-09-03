import { defineConfig } from "@tanstack/start/config";

export default defineConfig({
  deployment: {
    preset: "static",
  },
  server: {
    prerender: {
      routes: ["/"],
    },
  },
});
