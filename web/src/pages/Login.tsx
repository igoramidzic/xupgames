import { useClerk, useSignIn, useSignUp } from '@clerk/clerk-react';
import type { EmailCodeFactor } from '@clerk/types';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type AuthState = 'options' | 'email' | 'verification';

const EMAIL_LOGIN_ENABLED = import.meta.env.DEV;

export default function Login() {
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [authState, setAuthState] = useState<AuthState>('options');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  const isReady = signInLoaded && signUpLoaded;

  function startResendCooldown() {
    setResendCooldown(60);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  function validateEmail(value: string): string | null {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email';
    return null;
  }

  async function sendEmailOtp(targetEmail: string) {
    if (!isReady || !signIn || !signUp) {
      return { success: false, isNewUser: false, error: 'Authentication not initialized' };
    }

    try {
      try {
        const created = await signIn.create({ identifier: targetEmail });
        const emailCodeFactor = created.supportedFirstFactors?.find(
          (f): f is EmailCodeFactor => f.strategy === 'email_code'
        );
        if (!emailCodeFactor) {
          return { success: false, isNewUser: false, error: 'Email OTP not available' };
        }
        await created.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailCodeFactor.emailAddressId,
        });
        return { success: true, isNewUser: false };
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { code: string; message: string }[] };
        const notFound = clerkErr.errors?.some((e) => e.code === 'form_identifier_not_found');
        if (notFound) {
          await signUp.create({ emailAddress: targetEmail });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          return { success: true, isNewUser: true };
        }
        const captcha = clerkErr.errors?.find((e) => e.code === 'captcha_invalid');
        if (captcha) {
          return {
            success: false,
            isNewUser: false,
            error: 'CAPTCHA verification required. Disable bot protection in Clerk for dev.',
          };
        }
        throw err;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send code';
      return { success: false, isNewUser: false, error: message };
    }
  }

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await sendEmailOtp(email);
    setLoading(false);

    if (result.success) {
      setIsNewUser(result.isNewUser);
      setAuthState('verification');
      startResendCooldown();
    } else {
      setErrorMessage(result.error ?? 'Failed to send verification code. Please try again.');
    }
  }

  async function verifyOtp(code: string) {
    if (code.length !== 6 || !isReady || !signIn || !signUp || !setActive) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isNewUser) {
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === 'complete' && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          setSuccessMessage('Successfully authenticated! Redirecting...');
          navigate(redirectUrl ?? '/', { replace: true });
          return;
        }
      } else {
        const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
        if (result.status === 'complete' && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          setSuccessMessage('Successfully authenticated! Redirecting...');
          navigate(redirectUrl ?? '/', { replace: true });
          return;
        }
      }
      setErrorMessage('Invalid verification state');
      setOtp('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid or expired verification code.';
      setErrorMessage(message);
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await sendEmailOtp(email);
    setLoading(false);

    if (result.success) {
      setIsNewUser(result.isNewUser);
      setSuccessMessage('New verification code sent to your email.');
      startResendCooldown();
    } else {
      setErrorMessage(result.error ?? 'Failed to resend verification code.');
    }
  }

  async function handleGoogle() {
    if (!isReady || !signIn) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const redirect = `${window.location.origin}/auth/callback`;
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: redirect,
        redirectUrlComplete: redirect,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to authenticate with Google';
      setErrorMessage(message);
      setLoading(false);
    }
  }

  function backToOptions() {
    setAuthState('options');
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmail('');
    setEmailError(null);
  }

  function backToEmail() {
    setAuthState('email');
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtp('');
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      setResendCooldown(0);
    }
  }

  if (!clerk || !isReady) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="text-primary h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen items-center justify-center overflow-y-auto p-4 select-none">
      <div className="w-full max-w-[280px]">
        {authState === 'options' && (
          <div className="flex flex-col items-center gap-8">
            <h1 className="text-center text-xl font-semibold">Log in</h1>

            {errorMessage && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex w-full flex-col gap-3">
              <Button size="lg" type="button" className="w-full" disabled={loading} onClick={handleGoogle}>
                {loading ? 'Connecting...' : 'Continue with Google'}
              </Button>

              {EMAIL_LOGIN_ENABLED && (
                <Button
                  size="lg"
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    setAuthState('email');
                    setErrorMessage(null);
                  }}
                >
                  Continue with email
                </Button>
              )}
            </div>
          </div>
        )}

        {authState === 'email' && (
          <div className="flex flex-col items-center gap-8">
            <h1 className="text-center text-xl font-semibold">What's your email address?</h1>

            {errorMessage && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmitEmail} className="flex w-full flex-col gap-4" noValidate>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address..."
                autoComplete="email"
                className="h-10 w-full"
              />

              {emailError && <p className="text-destructive mb-4 text-sm">{emailError}</p>}

              <Button size="lg" type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Continue with email'}
              </Button>
            </form>

            <Button
              type="button"
              variant="link"
              className="text-foreground/50 p-2 text-xs font-normal"
              onClick={backToOptions}
            >
              Back to login
            </Button>
          </div>
        )}

        {authState === 'verification' && (
          <div className="flex flex-col items-center gap-8">
            <h1 className="text-center text-xl font-semibold">Check your email</h1>

            <div className="-mt-4 text-center text-sm leading-relaxed">
              <p>We've sent you a temporary login code.</p>
              <p>Please check your inbox at {email}.</p>
            </div>

            <div className="flex w-full flex-col items-center gap-2">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  if (value.length === 6) void verifyOtp(value);
                }}
                disabled={loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="dark:bg-input/30 h-12 w-12 text-lg" />
                  <InputOTPSlot index={1} className="dark:bg-input/30 h-12 w-12 text-lg" />
                  <InputOTPSlot index={2} className="dark:bg-input/30 h-12 w-12 text-lg" />
                  <InputOTPSlot index={3} className="dark:bg-input/30 h-12 w-12 text-lg" />
                  <InputOTPSlot index={4} className="dark:bg-input/30 h-12 w-12 text-lg" />
                  <InputOTPSlot index={5} className="dark:bg-input/30 h-12 w-12 text-lg" />
                </InputOTPGroup>
              </InputOTP>
              {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
              {successMessage && <p className="text-muted-foreground text-sm">{successMessage}</p>}
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={loading || otp.length !== 6}
              onClick={() => void verifyOtp(otp)}
            >
              {loading ? 'Verifying...' : 'Continue with login code'}
            </Button>

            <div className="flex flex-col items-center gap-1">
              <Button
                type="button"
                variant="link"
                className="text-foreground/50 p-2 text-xs font-normal"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResend}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="text-foreground/50 p-2 text-xs font-normal"
                onClick={backToEmail}
              >
                Back to email
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
