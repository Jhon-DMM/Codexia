import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  root,
  base: './',
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        inicio: resolve(root, 'index.html'),
        cuenta: resolve(root, 'es/cuenta/index.html'),
        asistente: resolve(root, 'es/asistente.ia/index.html'),
        adminAcceso: resolve(root, 'es/admin/acceso.html'),
        admin: resolve(root, 'es/admin/index.html'),
        terminos: resolve(root, 'es/legal/terminos.html'),
        privacidad: resolve(root, 'es/legal/privacidad.html'),
        cookies: resolve(root, 'es/legal/cookies.html'),
        reembolsos: resolve(root, 'es/legal/reembolsos.html'),
      },
    },
  },
});
