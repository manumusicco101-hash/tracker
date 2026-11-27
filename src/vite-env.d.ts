/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

/** Versión de package.json, inyectada por Vite al compilar. */
declare const __APP_VERSION__: string;

/** Identificador del build (commit en Vercel o fecha del build), inyectado por Vite. */
declare const __APP_BUILD__: string;
