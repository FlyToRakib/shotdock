import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/tokens.css';
import './options.css';
import { SettingsPage } from './Settings';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <SettingsPage />
    </StrictMode>,
  );
}
