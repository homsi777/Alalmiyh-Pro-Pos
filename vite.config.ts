import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // هذا السطر هو الحل لمكلة الشاشة البيضاء في Electron
  // يضمن تحميل الملفات من المسار النسبي الحالي بدلاً من جذر القرص
  base: './', 
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  // 🛑 إضافة إعدادات الخادم والـ Headers لحل مشكلة WASM LinkError 🛑
  // هذه الإعدادات ضرورية لتفعيل سياسات الأمان التي يحتاجها WASM للتشغيل في المتصفح
  server: {
    // 1. تفعيل رؤوس الأمان Cross-Origin الضرورية لملفات WebAssembly
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // 🛑 نهاية إضافة إعدادات الخادم 🛑
});