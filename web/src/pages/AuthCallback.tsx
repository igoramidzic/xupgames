import { useAuth, useClerk, useSignIn, useSignUp } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MAX_AUTH_WAIT_MS = 10000;
const CHECK_INTERVAL_MS = 100;

export default function AuthCallback() {
  const navigate = useNavigate();
  const clerk = useClerk();
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clerkLoaded || !signInLoaded || !signUpLoaded || !signIn || !signUp) return;

    const activeSignIn = signIn;
    const activeSignUp = signUp;
    let cancelled = false;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get('error');
      const errorDescription = params.get('error_description');
      if (oauthError) {
        const message = errorDescription ?? `Authentication failed: ${oauthError}`;
        setError(message);
        setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      try {
        // If OAuth returned a transferable verification, transfer to sign-up to create the user.
        if (activeSignIn.firstFactorVerification?.status === 'transferable') {
          const result = await activeSignUp.create({ transfer: true });
          if (result.status === 'complete' && result.createdSessionId) {
            await clerk.setActive({ session: result.createdSessionId });
          }
        } else if (activeSignIn.status === 'complete' && activeSignIn.createdSessionId) {
          await clerk.setActive({ session: activeSignIn.createdSessionId });
        } else if (activeSignUp.status === 'complete' && activeSignUp.createdSessionId) {
          await clerk.setActive({ session: activeSignUp.createdSessionId });
        }

        const startTime = Date.now();
        while (!cancelled) {
          if (clerk.session) {
            navigate('/', { replace: true });
            return;
          }
          if (Date.now() - startTime > MAX_AUTH_WAIT_MS) {
            throw new Error('Authentication timeout - please try again');
          }
          await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(message);
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    }

    if (isSignedIn) {
      navigate('/', { replace: true });
      return;
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [clerk, clerkLoaded, isSignedIn, navigate, signIn, signInLoaded, signUp, signUpLoaded]);

  return (
    <div className="bg-background flex h-screen items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-destructive mb-4">{error}</div>
            <button
              type="button"
              className="bg-primary text-primary-foreground rounded px-4 py-2"
              onClick={() => navigate('/login', { replace: true })}
            >
              Return to Login
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-primary h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <div className="text-muted-foreground text-sm">Verifying your login...</div>
          </div>
        )}
      </div>
    </div>
  );
}
