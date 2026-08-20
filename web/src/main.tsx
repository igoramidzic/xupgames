import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing root element');
}

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  createRoot(rootElement).render(
    <main className="configuration-error">
      <p className="eyebrow">Xup Games</p>
      <h1>Connect the canvas.</h1>
      <p>
        Add <code>VITE_CONVEX_URL</code> to <code>web/.env.local</code>, then restart the app.
      </p>
    </main>
  );
} else {
  const convex = new ConvexReactClient(convexUrl);

  createRoot(rootElement).render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProvider>
    </StrictMode>
  );
}
