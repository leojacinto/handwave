import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "build" ? [viteSingleFile()] : [])],
  server: {
    port: 5173,
    // Hand tracking needs camera access, which browsers only grant on
    // https or http://localhost — this dev server always binds localhost.
    host: "localhost",
  },
  build: {
    // Draft Punk's AIUX static host only serves image/font files from
    // public/ — .js/.css requests 404 there — so this build is inlined
    // into one self-contained index.html and embedded via iframe.srcdoc
    // instead (see pages/handwave/handwave-embed.js in draft-punk).
    target: "es2020",
  },
}));
