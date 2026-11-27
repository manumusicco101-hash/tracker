import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { AppDataProvider } from './state/AppDataProvider';
import { ConfirmProvider } from './state/ConfirmProvider';
import { ToastProvider } from './state/ToastProvider';
import { watchViewportDrift } from './utils/scrollLock';

// iOS a veces deja la vista corrida respecto de lo fijo al cerrar el teclado: se corrige solo.
watchViewportDrift();

// Sin <StrictMode>: su doble montaje en desarrollo duplica las entradas de historial
// que usan los paneles para que el botón "atrás" de Android los cierre.
const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root.');

createRoot(root).render(
  <ToastProvider>
    <ConfirmProvider>
      <AppDataProvider>
        <App />
      </AppDataProvider>
    </ConfirmProvider>
  </ToastProvider>,
);
