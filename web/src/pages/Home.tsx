import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GAME_TYPES, GamePreview, type GameType } from '@/games/registry';
import { readGuest, saveGuest, validateDisplayName } from '@/lib/guest';
import { userFacingError } from '@/lib/userFacingError';

export const HOME_PREVIEW_HOLD_MS = 5_000;
export const HOME_PREVIEW_FADE_MS = 300;

function randomPreviewIndex() {
  return Math.floor(Math.random() * GAME_TYPES.length);
}

export default function Home() {
  const navigate = useNavigate();
  const createRoom = useMutation(api.rooms.create);
  const [previewIndex, setPreviewIndex] = useState(randomPreviewIndex);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [displayName, setDisplayName] = useState(() => readGuest()?.displayName ?? '');
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewGameType: GameType = GAME_TYPES[previewIndex] ?? GAME_TYPES[0];

  useEffect(() => {
    let holdTimeout: number | undefined;
    let fadeTimeout: number | undefined;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    function clearPreviewTimers() {
      if (holdTimeout !== undefined) window.clearTimeout(holdTimeout);
      if (fadeTimeout !== undefined) window.clearTimeout(fadeTimeout);
    }

    function scheduleNextPreview() {
      holdTimeout = window.setTimeout(() => {
        if (prefersReducedMotion) {
          setPreviewIndex((currentIndex) => (currentIndex + 1) % GAME_TYPES.length);
          scheduleNextPreview();
          return;
        }

        setPreviewVisible(false);
        fadeTimeout = window.setTimeout(() => {
          setPreviewIndex((currentIndex) => (currentIndex + 1) % GAME_TYPES.length);
          setPreviewVisible(true);
          scheduleNextPreview();
        }, HOME_PREVIEW_FADE_MS);
      }, HOME_PREVIEW_HOLD_MS);
    }

    function handleVisibilityChange() {
      clearPreviewTimers();
      setPreviewVisible(true);
      if (!document.hidden) scheduleNextPreview();
    }

    if (!document.hidden) scheduleNextPreview();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearPreviewTimers();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = validateDisplayName(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const guest = saveGuest(displayName);
      const room = await createRoom({
        ...guest,
        ...(passwordProtected ? { password } : {}),
      });
      navigate(`/r/${room.code}`);
    } catch (createError) {
      setError(userFacingError(createError, 'The room could not be created. Try again.'));
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_74%_16%,rgb(255_255_255/90%)_0_16rem,transparent_34rem),linear-gradient(135deg,#f7f9fd_0%,#edf2fa_62%,#e9eef8_100%)]">
      <header className="mx-auto flex h-22 w-[min(100%-48px,1440px)] items-center justify-between max-[620px]:h-18 max-[620px]:w-[calc(100%-32px)]">
        <a
          className="inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline"
          href="/"
          aria-label="Xup Games home"
        >
          <span
            className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
            aria-hidden="true"
          >
            X
          </span>
          <span>Xup Games</span>
        </a>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-136px)] w-[min(100%-96px,1360px)] animate-in grid-cols-[minmax(390px,0.88fr)_minmax(520px,1.12fr)] items-center gap-[clamp(56px,7vw,120px)] py-8 pb-20 fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none max-[1040px]:w-[min(100%-56px,760px)] max-[1040px]:grid-cols-1 max-[1040px]:gap-20.5 max-[1040px]:pt-18 max-[620px]:w-[calc(100%-32px)] max-[620px]:py-10.5 max-[620px]:pb-14">
        <section className="relative z-2 max-w-152.5 max-[1040px]:max-w-170">
          <p className="mb-3 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">
            Make the room. Pick the game together.
          </p>
          <h1 className="m-0 max-w-135 font-display text-[clamp(48px,5vw,78px)] leading-[0.88] font-[820] tracking-[-0.065em] text-[#17203a] max-[620px]:text-[clamp(44px,14vw,60px)]">
            One link.
            <span className="block text-[#3155d9]"> Everyone plays.</span>
          </h1>

          <form
            className="mt-6 w-[min(100%,560px)] rounded-[20px_16px_23px_17px] border border-[rgb(116_132_164/32%)] bg-[rgb(255_255_255/86%)] p-5 shadow-[0_18px_50px_rgb(52_73_118/10%)] backdrop-blur-[14px] max-[620px]:mt-5 max-[620px]:box-border max-[620px]:p-4"
            onSubmit={handleCreateRoom}
          >
            <label className="mb-2.5 ml-0.5 block text-[13px] font-[720] text-[#323e58]" htmlFor="display-name">
              What should we call you?
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 max-[620px]:grid-cols-1">
              <input
                className="h-13 w-full rounded-xl border-[1.5px] border-[#b9c4d7] bg-white px-4 text-base text-[#17203a] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#3155d9] focus:shadow-[0_0_0_4px_rgb(49_85_217/13%)] aria-invalid:border-[#d43c45] motion-reduce:transition-none"
                id="display-name"
                name="displayName"
                autoComplete="nickname"
                maxLength={24}
                placeholder="Your name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-describedby={error ? 'create-error' : 'create-hint'}
                aria-invalid={Boolean(error)}
              />
              <Button
                className="min-w-40 max-[620px]:w-full"
                variant="brand"
                size="lg"
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {isCreating ? 'Opening…' : 'Create a room'}
              </Button>
            </div>
            <label
              className="mt-4 ml-0.5 flex w-fit cursor-pointer items-center gap-2 text-[13px] font-[720] text-[#323e58]"
              htmlFor="password-protected"
            >
              <input
                className="size-4 accent-[#3155d9]"
                id="password-protected"
                type="checkbox"
                checked={passwordProtected}
                onChange={(event) => {
                  setPasswordProtected(event.target.checked);
                  setError(null);
                }}
              />
              <LockKeyhole className="size-3.75 text-[#3155d9]" aria-hidden="true" />
              Require a password to join
            </label>
            {passwordProtected ? (
              <div className="mt-3.5">
                <label className="mb-2.5 ml-0.5 block text-[13px] font-[720] text-[#323e58]" htmlFor="room-password">
                  Room password
                </label>
                <input
                  className="box-border h-12 w-full rounded-xl border-[1.5px] border-[#b9c4d7] bg-white px-4 text-base text-[#17203a] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#3155d9] focus:shadow-[0_0_0_4px_rgb(49_85_217/13%)] aria-invalid:border-[#d43c45] motion-reduce:transition-none"
                  id="room-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={4}
                  maxLength={64}
                  required
                  placeholder="At least 4 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'create-error' : 'create-hint'}
                />
              </div>
            ) : null}
            {error ? (
              <p
                className="mt-2.5 ml-0.5 min-h-4.5 text-xs leading-[1.45] font-[650] text-[#b72934]"
                id="create-error"
                role="alert"
              >
                {error}
              </p>
            ) : (
              <p className="mt-2.5 ml-0.5 min-h-4.5 text-xs leading-[1.45] text-[#7a8499]" id="create-hint">
                No account. Invite everyone, then vote on the first game inside the room.
              </p>
            )}
          </form>
        </section>

        <div
          className="min-w-0 opacity-0 transition-opacity duration-300 ease-in-out data-[visible=true]:opacity-100 motion-reduce:transition-none"
          data-visible={previewVisible}
          data-preview-carousel
        >
          <GamePreview key={previewGameType} gameType={previewGameType} />
        </div>
      </main>
    </div>
  );
}
