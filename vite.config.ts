import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:ipad` bật HTTPS tự ký để Safari trên iPad cho phép dùng micro qua mạng LAN.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'ipad' ? [basicSsl()] : [])],
}));
