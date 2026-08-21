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
    <main className="grid min-h-screen place-content-center p-8 text-center">
      <p className="mb-5 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Xup Games</p>
      <h1 className="mb-2.5 font-display text-5xl tracking-[-0.04em]">Connect the canvas.</h1>
      <p className="max-w-135 leading-[1.6] text-[#59647b]">
        Add <code className="rounded-[5px] bg-[#e1e7f3] px-1.5 py-0.5 text-[#243db0]">VITE_CONVEX_URL</code> to{' '}
        <code className="rounded-[5px] bg-[#e1e7f3] px-1.5 py-0.5 text-[#243db0]">web/.env.local</code>, then restart
        the app.
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
