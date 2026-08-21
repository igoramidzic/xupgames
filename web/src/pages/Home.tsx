import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { ArrowRight, BrainCircuit, LoaderCircle, LockKeyhole, PencilLine, Timer, UsersRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readGuest, saveGuest, validateDisplayName } from '@/lib/guest';
import { userFacingError } from '@/lib/userFacingError';

export default function Home() {
  const navigate = useNavigate();
  const createRoom = useMutation(api.rooms.create);
  const [gameType, setGameType] = useState<'drawing' | 'trivia'>('drawing');
  const [displayName, setDisplayName] = useState(() => readGuest()?.displayName ?? '');
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
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
      const room = await createRoom({
        gameType,
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
          Realtime game rooms
        </div>
      </header>

      <main className="home-main">
        <section className="home-copy">
          <p className="eyebrow">Pick a game. Bring up to 50 people.</p>
          <h1>
            One link.
            <span className="headline-accent"> Everyone plays.</span>
          </h1>
          <p className="home-intro">
            Open a room for a shared canvas or a ten-question trivia sprint. No accounts, installs, or waiting around.
          </p>

          <form className="create-room-card" onSubmit={handleCreateRoom}>
            <fieldset className="game-picker">
              <legend>Choose a game</legend>
              <button
                type="button"
                className="game-option"
                data-selected={gameType === 'drawing'}
                aria-pressed={gameType === 'drawing'}
                onClick={() => setGameType('drawing')}
              >
                <span className="game-option-icon game-option-icon-drawing">
                  <PencilLine aria-hidden="true" />
                </span>
                <span>
                  <strong>Drawing</strong>
                  <small>One canvas, total chaos</small>
                </span>
              </button>
              <button
                type="button"
                className="game-option"
                data-selected={gameType === 'trivia'}
                aria-pressed={gameType === 'trivia'}
                onClick={() => setGameType('trivia')}
              >
                <span className="game-option-icon game-option-icon-trivia">
                  <BrainCircuit aria-hidden="true" />
                </span>
                <span>
                  <strong>Trivia</strong>
                  <small>Fast answers score more</small>
                </span>
              </button>
            </fieldset>
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
            <label className="password-toggle" htmlFor="password-protected">
              <input
                id="password-protected"
                type="checkbox"
                checked={passwordProtected}
                onChange={(event) => {
                  setPasswordProtected(event.target.checked);
                  setError(null);
                }}
              />
              <LockKeyhole aria-hidden="true" />
              Require a password to join
            </label>
            {passwordProtected ? (
              <div className="create-password-field">
                <label htmlFor="room-password">Room password</label>
                <input
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

        <section
          className="preview-stage"
          aria-label={gameType === 'drawing' ? 'A preview of the shared drawing canvas' : 'A preview of a trivia round'}
        >
          <div className="preview-tape">ROOM F7K2P</div>
          {gameType === 'drawing' ? (
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
          ) : (
            <div className="preview-board preview-trivia-board">
              <div className="preview-trivia-topline">
                <span>QUESTION 7 / 10</span>
                <span className="preview-trivia-timer">
                  <Timer aria-hidden="true" /> 08.4
                </span>
              </div>
              <p className="preview-trivia-category">SCIENCE</p>
              <h2>Which planet has an axial tilt of roughly 98 degrees?</h2>
              <div className="preview-trivia-options">
                <span>A · Saturn</span>
                <span>B · Neptune</span>
                <span>C · Mars</span>
                <span className="is-picked">D · Uranus</span>
              </div>
              <div className="preview-trivia-score">
                <div>
                  <small>YOUR SCORE</small>
                  <strong>4,620</strong>
                </div>
                <p>
                  <span>1</span> Maya <strong>5,180</strong>
                </p>
                <p className="is-you">
                  <span>2</span> You <strong>4,620</strong>
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
