import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { ArrowRight, LoaderCircle, UsersRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readGuest, saveGuest, validateDisplayName } from '@/lib/guest';

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^Uncaught Error:\s*/, '');
  }

  return 'The room could not be created. Try again.';
}

export default function Home() {
  const navigate = useNavigate();
  const createRoom = useMutation(api.rooms.create);
  const [displayName, setDisplayName] = useState(() => readGuest()?.displayName ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const room = await createRoom(guest);
      navigate(`/r/${room.code}`);
    } catch (createError) {
      setError(errorMessage(createError));
      setIsCreating(false);
    }
  }

  return (
    <div className="home-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Xup Games home">
          <span className="wordmark-mark" aria-hidden="true">
            X
          </span>
          <span>Xup Games</span>
        </a>
        <div className="header-note">
          <span className="live-dot" />
          Realtime drawing rooms
        </div>
      </header>

      <main className="home-main">
        <section className="home-copy">
          <p className="eyebrow">One canvas. Up to 50 people.</p>
          <h1>
            Draw over
            <span className="headline-accent"> each other.</span>
          </h1>
          <p className="home-intro">
            Make a room, pass around the link, and share one gloriously chaotic sheet. Every mark lands live and in
            order.
          </p>

          <form className="create-room-card" onSubmit={handleCreateRoom}>
            <label htmlFor="display-name">What should we call you?</label>
            <div className="create-room-row">
              <input
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
              <button className="primary-action" type="submit" disabled={isCreating}>
                {isCreating ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                {isCreating ? 'Opening…' : 'Create a room'}
              </button>
            </div>
            {error ? (
              <p className="form-error" id="create-error" role="alert">
                {error}
              </p>
            ) : (
              <p className="form-hint" id="create-hint">
                No account. Your browser remembers you.
              </p>
            )}
          </form>

          <div className="home-footnote">
            <UsersRound aria-hidden="true" />
            Anyone with the link can join while there is room.
          </div>
        </section>

        <section className="preview-stage" aria-label="A preview of the shared drawing canvas">
          <div className="preview-tape">ROOM F7K2P</div>
          <div className="preview-board">
            <div className="preview-grid" />
            <svg className="preview-drawing" viewBox="0 0 720 560" role="img" aria-label="Overlapping colorful lines">
              <path className="stroke stroke-coral" d="M50 370 C 150 165, 310 490, 430 250 S 610 190, 675 75" />
              <path className="stroke stroke-blue" d="M75 155 C 180 105, 185 415, 345 330 S 500 105, 650 330" />
              <path className="stroke stroke-yellow" d="M130 445 C 205 330, 345 185, 595 390" />
              <path className="stroke stroke-mint" d="M215 70 C 325 175, 445 80, 555 195" />
            </svg>
            <div className="preview-person preview-person-one">
              <span /> Maya
            </div>
            <div className="preview-person preview-person-two">
              <span /> Theo
            </div>
            <div className="preview-person preview-person-three">
              <span /> You
            </div>
            <div className="preview-caption">
              <span className="live-dot" /> 3 drawing now
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
