import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    base: "/svxmet/",
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3040", // alternativ: "http://192.168.188.49:3040"
        changeOrigin: true
      }
    }
  }
});
