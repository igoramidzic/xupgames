import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { ArrowRight, BrainCircuit, Keyboard, LoaderCircle, LockKeyhole, Timer, UsersRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { readGuest, saveGuest, validateDisplayName } from '@/lib/guest';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

export default function Home() {
  const navigate = useNavigate();
  const createRoom = useMutation(api.rooms.create);
  const [gameType, setGameType] = useState<'trivia' | 'typeRacer'>('trivia');
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
          <p className="mb-5 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">
            Pick a game. Bring up to 50 people.
          </p>
          <h1 className="m-0 max-w-162.5 font-display text-[clamp(62px,6.8vw,108px)] leading-[0.83] font-[820] tracking-[-0.075em] text-[#17203a] max-[620px]:text-[clamp(54px,18vw,74px)]">
            One link.
            <span className="block text-[#3155d9]"> Everyone plays.</span>
          </h1>
          <p className="mt-8 max-w-135 text-[clamp(17px,1.4vw,20px)] leading-[1.58] text-[#59647b] max-[620px]:mt-6 max-[620px]:text-[17px]">
            Open a ten-question trivia sprint or a live type race. No accounts or installs.
          </p>

          <form
            className="mt-9.5 w-[min(100%,560px)] rounded-[20px_16px_23px_17px] border border-[rgb(116_132_164/32%)] bg-[rgb(255_255_255/86%)] p-5 shadow-[0_18px_50px_rgb(52_73_118/10%)] backdrop-blur-[14px] max-[620px]:mt-7.5 max-[620px]:box-border max-[620px]:p-4"
            onSubmit={handleCreateRoom}
          >
            <fieldset className="mb-5 grid grid-cols-2 gap-2.25 border-0 p-0 max-[520px]:grid-cols-1">
              <legend className="col-span-full mb-2.5 ml-0.5 p-0 text-[13px] font-[720] text-[#323e58]">
                Choose a game
              </legend>
              <Button
                type="button"
                variant="choice"
                className="min-h-17 min-w-0 justify-start gap-2.75 p-3"
                data-selected={gameType === 'typeRacer'}
                aria-pressed={gameType === 'typeRacer'}
                onClick={() => setGameType('typeRacer')}
              >
                <span className="grid size-8.5 shrink-0 place-items-center rounded-[9px_7px_10px_8px] bg-[#ffe1df] text-[#c93f43]">
                  <Keyboard className="size-4.25" aria-hidden="true" />
                </span>
                <span className="grid min-w-0">
                  <strong className="font-display text-sm font-[780] text-[#17203a]">Type racer</strong>
                  <small className="overflow-hidden text-[10px] font-[580] text-ellipsis whitespace-nowrap text-[#748097]">
                    Every letter moves you
                  </small>
                </span>
              </Button>
              <Button
                type="button"
                variant="choice"
                className="min-h-17 min-w-0 justify-start gap-2.75 p-3"
                data-selected={gameType === 'trivia'}
                aria-pressed={gameType === 'trivia'}
                onClick={() => setGameType('trivia')}
              >
                <span className="grid size-8.5 shrink-0 place-items-center rounded-[9px_7px_10px_8px] bg-[#fff0b8] text-[#715700]">
                  <BrainCircuit className="size-4.25" aria-hidden="true" />
                </span>
                <span className="grid min-w-0">
                  <strong className="font-display text-sm font-[780] text-[#17203a]">Trivia</strong>
                  <small className="overflow-hidden text-[10px] font-[580] text-ellipsis whitespace-nowrap text-[#748097]">
                    Fast answers score more
                  </small>
                </span>
              </Button>
            </fieldset>
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
                No account. Your browser remembers you.
              </p>
            )}
          </form>

          <div className="mt-6 ml-0.5 flex items-center gap-2.25 text-[13px] font-[620] text-[#59647b] max-[620px]:items-start">
            <UsersRound className="size-4.25 text-[#3155d9]" aria-hidden="true" />
            Anyone with the link can join while there is room.
          </div>
        </section>

        <section
          className="relative mx-auto w-[min(100%,760px)] [perspective:1200px] max-[1040px]:mb-16 max-[1040px]:w-[min(92%,700px)] max-[620px]:w-[94%]"
          aria-label={gameType === 'trivia' ? 'A preview of a trivia round' : 'A preview of a multiplayer type race'}
        >
          <div className="absolute -top-5.5 left-10.5 z-3 -rotate-4 bg-[rgb(49_85_217/92%)] px-7.5 pt-3.25 pb-2.75 font-display text-[13px] font-extrabold tracking-[0.12em] text-white [clip-path:polygon(7px_0,calc(100%-7px)_0,100%_7px,calc(100%-2px)_calc(100%-6px),calc(100%-7px)_100%,6px_100%,0_calc(100%-7px),2px_6px)] [filter:drop-shadow(0_8px_9px_rgb(49_85_217/22%))] max-[620px]:left-5">
            ROOM F7K2P
          </div>
          {gameType === 'trivia' ? (
            <div className="grid aspect-[1.24] rotate-[-1.2deg] grid-cols-[minmax(0,1fr)_168px] grid-rows-[auto_auto_minmax(0,1fr)] gap-x-6 overflow-hidden rounded-[28px_18px_32px_20px] border border-[#142747] bg-[#f8fbff] p-[clamp(28px,4vw,52px)] font-trivia text-[#10213d] shadow-[0_35px_80px_rgb(11_28_56/22%),16px_20px_0_#132746] max-[520px]:grid-cols-1 max-[520px]:px-6 max-[520px]:py-8">
              <div className="col-start-1 col-end-2 flex items-center justify-between border-b border-[#cfd9e8] pb-3.25 text-[10px] font-[760] tracking-[0.1em] text-[#52647e] max-[520px]:col-start-1 max-[520px]:col-end-2">
                <span>QUESTION 7 / 10</span>
                <span className="inline-flex items-center gap-1.25 tracking-[0.04em] text-[#e24e44] tabular-nums">
                  <Timer className="size-3.25" aria-hidden="true" /> 08.4
                </span>
              </div>
              <p className="col-start-1 col-end-2 mt-6.5 mb-2.25 text-[10px] font-[820] tracking-[0.14em] text-[#1a65a8] max-[520px]:col-start-1 max-[520px]:col-end-2">
                SCIENCE
              </p>
              <h2 className="col-start-1 col-end-2 m-0 font-trivia text-[clamp(26px,3vw,43px)] leading-[1.02] font-[790] tracking-[-0.045em] text-[#10213d] [font-stretch:condensed] max-[520px]:col-start-1 max-[520px]:col-end-2">
                Which planet has an axial tilt of roughly 98 degrees?
              </h2>
              <div className="col-start-1 col-end-2 mt-7 grid grid-cols-2 gap-2 self-end max-[520px]:col-start-1 max-[520px]:col-end-2">
                <span className="rounded-[9px_7px_10px_8px] border border-[#cbd6e6] bg-white px-3.25 py-3 text-[11px] font-[680] text-[#3f506a]">
                  A · Saturn
                </span>
                <span className="rounded-[9px_7px_10px_8px] border border-[#cbd6e6] bg-white px-3.25 py-3 text-[11px] font-[680] text-[#3f506a]">
                  B · Neptune
                </span>
                <span className="rounded-[9px_7px_10px_8px] border border-[#cbd6e6] bg-white px-3.25 py-3 text-[11px] font-[680] text-[#3f506a]">
                  C · Mars
                </span>
                <span className="rounded-[9px_7px_10px_8px] border border-[#f0bc17] bg-[#ffdd61] px-3.25 py-3 text-[11px] font-[680] text-[#352900] shadow-[3px_3px_0_#132746]">
                  D · Uranus
                </span>
              </div>
              <div className="col-start-2 col-end-3 row-start-1 row-end-[-1] flex flex-col border-l border-[#d6deea] pl-5.5 max-[520px]:hidden">
                <div className="mb-auto rounded-[15px_11px_17px_12px] bg-[#132746] p-4 text-white">
                  <small className="mb-1.5 block text-[8px] font-[760] tracking-[0.11em] text-[#8fb6d9]">
                    YOUR SCORE
                  </small>
                  <strong className="font-trivia text-[27px] font-[760] tracking-[-0.035em]">4,620</strong>
                </div>
                <p className="mt-1.75 grid grid-cols-[20px_1fr_auto] items-center gap-1.5 border-b border-[#dce3ed] px-1.75 py-2 text-[9px] text-[#65758c]">
                  <span className="font-extrabold text-[#8593a6]">1</span> Maya{' '}
                  <strong className="text-[#23344f] tabular-nums">5,180</strong>
                </p>
                <p className="mt-1.75 grid grid-cols-[20px_1fr_auto] items-center gap-1.5 rounded-md border-b border-[#dce3ed] bg-[#e8f3ff] px-1.75 py-2 text-[9px] text-[#174e80]">
                  <span className="font-extrabold text-[#8593a6]">2</span> You{' '}
                  <strong className="text-[#23344f] tabular-nums">4,620</strong>
                </p>
              </div>
            </div>
          ) : (
            <TypeRacerPreview />
          )}
        </section>
      </main>
    </div>
  );
}

function TypeRacerPreview() {
  const passage = 'All children, except one, grow up.';
  const typedLength = 22;
  const occurrences = new Map<string, number>();
  const characters = Array.from(passage, (character) => {
    const occurrence = (occurrences.get(character) ?? 0) + 1;
    occurrences.set(character, occurrence);
    return { character, key: `${character}-${occurrence}` };
  });
  return (
    <div className="grid aspect-[1.24] rotate-[0.8deg] grid-cols-[minmax(0,1fr)_158px] gap-5 overflow-hidden rounded-[18px_30px_20px_27px] border border-[#2b1b45] bg-[#f9fbff] p-[clamp(24px,3.8vw,48px)] text-[#2b1b45] shadow-[0_35px_80px_rgb(43_27_69/20%),16px_20px_0_#c8d4f0] max-[520px]:grid-cols-1 max-[520px]:p-6">
      <div className="flex min-w-0 flex-col">
        <div className="mb-7 flex items-center justify-between border-b border-[#d9e0f2] pb-3 text-[9px] font-[820] tracking-[0.12em] text-[#746b86]">
          <span>RACE 04 · PHRASE</span>
          <span className="text-[#ff5c57]">62 WPM</span>
        </div>
        <p className="m-0 font-trivia text-[clamp(23px,3.2vw,42px)] leading-[1.5] font-[620] tracking-[-0.025em] whitespace-pre-wrap">
          {characters.map(({ character, key }, index) => (
            <span
              className={cn(
                index < typedLength ? 'bg-[#dff6ec] text-[#211833]' : 'text-[#aaa4b1]',
                index === typedLength && 'border-l-2 border-[#4f6ee8] bg-[#e8edff]'
              )}
              key={key}
            >
              {character}
            </span>
          ))}
        </p>
        <p className="mt-auto mb-0 pt-5 text-[9px] font-[720] text-[#7a718b]">Peter Pan · J. M. Barrie</p>
      </div>
      <div className="flex flex-col gap-3 border-l border-[#d8deef] pl-4 max-[520px]:hidden">
        <p className="m-0 text-[8px] font-[840] tracking-[0.12em] text-[#776f88]">LIVE FIELD</p>
        {[
          { name: 'Maya', progress: 82, color: '#ff5c57' },
          { name: 'You', progress: 61, color: '#4f6ee8' },
          { name: 'Theo', progress: 44, color: '#2da875' },
        ].map((racer, index) => (
          <div key={racer.name}>
            <div className="mb-1 flex justify-between text-[8px] font-[720]">
              <span>
                {index + 1} · {racer.name}
              </span>
              <span>{racer.progress}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-[#e1e6f3]">
              <span
                className="absolute inset-y-0 left-0 rounded-full opacity-75"
                style={{ width: `${racer.progress}%`, backgroundColor: racer.color }}
              />
              <span
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px_6px] border border-[#2b1b45] shadow-[1px_1px_0_#2b1b45]"
                style={{ left: `${racer.progress}%`, backgroundColor: racer.color }}
              />
            </div>
          </div>
        ))}
        <span className="mt-auto rounded-[8px_12px_9px_11px] bg-[#2b1b45] px-3 py-2 text-center text-[8px] font-[800] tracking-[0.08em] text-white">
          SPEED WINS
        </span>
      </div>
    </div>
  );
}
