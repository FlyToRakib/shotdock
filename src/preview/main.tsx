import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/tokens.css';
import './preview.css';
import { PreviewPage } from './PreviewPage';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <PreviewPage />
    </StrictMode>,
  );
}
