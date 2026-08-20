import { ClerkProvider } from '@clerk/clerk-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} signInUrl="/login" signUpUrl="/login" afterSignOutUrl="/login">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
