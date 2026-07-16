import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';

import App from './App';
import { initializeTheme } from './lib/theme';
import './styles/index.css';

initializeTheme();

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('The root application element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
