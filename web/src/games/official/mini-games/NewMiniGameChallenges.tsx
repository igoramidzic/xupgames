import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GameView = FunctionReturnType<typeof api.miniGames.getGame>;
type MiniGameRound = NonNullable<GameView['round']>;
type ChallengePayload = NonNullable<MiniGameRound['challengePayload']>;

export type NewMiniGameSubmission =
  | { kind: 'flashbackTiles'; selectedTileIds: number[] }
  | { kind: 'copycatSequence'; padIds: number[] }
  | { kind: 'crowdCount'; guess: number }
  | { kind: 'dropZone'; releasePositions: number[] }
  | { kind: 'shadowMatch'; selectedOptionIndices: number[] }
  | { kind: 'flagFrenzy'; pressedPads: number[] }
  | { kind: 'brakeCheck'; releaseValues: number[] }
  | { kind: 'signalSnap'; responseOffsetsMs: number[] };

const PAD_STYLES = [
  { symbol: '▲', label: 'Triangle', className: 'bg-[#ffd85c]' },
  { symbol: '●', label: 'Circle', className: 'bg-[#ff8f73]' },
  { symbol: '■', label: 'Square', className: 'bg-[#8fafff]' },
  { symbol: '◆', label: 'Diamond', className: 'bg-[#82d9ac]' },
] as const;

const SHAPE_GLYPHS: Record<string, string> = {
  star: '★',
  heart: '♥',
  moon: '☾',
  bolt: 'ϟ',
  diamond: '◆',
  flower: '✿',
};

function challengeFor<TKind extends ChallengePayload['kind']>(round: MiniGameRound, kind: TKind) {
  const challenge = round.challengePayload;
  return challenge?.kind === kind ? (challenge as Extract<ChallengePayload, { kind: TKind }>) : null;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (query === undefined) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function FlashbackTiles({
  round,
  now,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  now: number;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'flashbackTiles');
  const [selected, setSelected] = useState<number[]>([]);
  if (challenge === null) return null;
  const revealing = now < round.playStartsAt + challenge.revealDurationMs;
  const targets = new Set(challenge.targetTileIds);
  const tiles = Array.from({ length: challenge.gridSize ** 2 }, (_, id) => ({ id, key: `tile-${id}` }));
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-[#17203a] bg-[#fff0b8] px-4 py-3 text-xs font-[800] shadow-[4px_4px_0_#17203a]">
        <span>{revealing ? 'Memorize the glowing pattern' : 'Now rebuild the pattern'}</span>
        <span aria-live="polite">
          {revealing ? `${challenge.targetTileIds.length} tiles` : `${selected.length} selected`}
        </span>
      </div>
      <fieldset
        className="mx-auto grid aspect-square w-[min(76vw,470px)] grid-cols-5 gap-2 rounded-[22px_14px_24px_16px] border-2 border-[#17203a] bg-[#dfe9ff] p-3 shadow-[7px_7px_0_#17203a]"
        aria-label="Five by five memory tile board"
      >
        {tiles.map(({ id: tileId, key }) => {
          const lit = revealing ? targets.has(tileId) : selected.includes(tileId);
          return (
            <button
              key={key}
              type="button"
              className={cn(
                'grid place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-white text-sm font-black shadow-[2px_2px_0_#8296bd] transition-[transform,background-color] focus-visible:outline-4 focus-visible:outline-[#3155d9]/35 motion-reduce:transition-none',
                lit && 'translate-y-[-2px] bg-[#ffd85c] shadow-[3px_4px_0_#e85d2a]'
              )}
              aria-label={`Tile ${tileId + 1}`}
              aria-pressed={lit}
              disabled={disabled || revealing}
              onClick={() =>
                setSelected((current) =>
                  current.includes(tileId) ? current.filter((id) => id !== tileId) : [...current, tileId]
                )
              }
            >
              {lit ? '✦' : tileId + 1}
            </button>
          );
        })}
      </fieldset>
      <Button
        className="mt-5 min-w-40"
        type="button"
        variant="brand"
        disabled={disabled || revealing || selected.length === 0}
        onClick={() => onSubmit({ kind: 'flashbackTiles', selectedTileIds: selected })}
      >
        Lock pattern
      </Button>
    </div>
  );
}

function CopycatSequence({
  round,
  now,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  now: number;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'copycatSequence');
  const [pressed, setPressed] = useState<number[]>([]);
  const submittedRef = useRef(false);
  if (challenge === null) return null;
  const playbackElapsed = now - round.playStartsAt;
  const playbackDuration = challenge.sequence.length * challenge.playbackStepMs;
  const watching = playbackElapsed < playbackDuration;
  const activePad = watching
    ? challenge.sequence[Math.max(0, Math.floor(playbackElapsed / challenge.playbackStepMs))]
    : null;

  function press(padId: number) {
    if (watching || disabled || submittedRef.current) return;
    const next = [...pressed, padId];
    setPressed(next);
    const isWrong = challenge?.sequence[next.length - 1] !== padId;
    if (isWrong || next.length === challenge?.sequence.length) {
      submittedRef.current = true;
      onSubmit({ kind: 'copycatSequence', padIds: next });
    }
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-5 font-display text-2xl font-[850]" aria-live="polite">
        {watching
          ? `Watch… ${Math.min(challenge.sequence.length, Math.floor(playbackElapsed / challenge.playbackStepMs) + 1)} of ${challenge.sequence.length}`
          : `Your turn · ${pressed.length} of ${challenge.sequence.length}`}
      </p>
      <div className="mx-auto grid w-[min(82vw,520px)] grid-cols-2 gap-4 rounded-[24px_15px_26px_17px] border-2 border-[#17203a] bg-white p-5 shadow-[7px_7px_0_#a9c6ff]">
        {PAD_STYLES.map((pad, padId) => (
          <button
            key={pad.label}
            type="button"
            className={cn(
              'aspect-[4/3] rounded-[18px_11px_20px_13px] border-3 border-[#17203a] text-5xl shadow-[5px_5px_0_#17203a] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-4 focus-visible:outline-[#3155d9]/35 motion-reduce:transition-none',
              pad.className,
              activePad === padId && 'scale-105 brightness-125 shadow-[0_0_0_6px_#fff,0_0_0_10px_#e85d2a]'
            )}
            aria-label={`${pad.label} pad`}
            disabled={disabled || watching || submittedRef.current}
            onClick={() => press(padId)}
          >
            {pad.symbol}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs font-[720] text-[#68758b]">Pads stay in the same positions on every device.</p>
    </div>
  );
}

function CrowdCount({
  round,
  now,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  now: number;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'crowdCount');
  const reducedMotion = useReducedMotion();
  if (challenge === null) return null;
  const elapsed = Math.max(0, now - round.playStartsAt);
  const answering = elapsed >= 6_800;
  return (
    <div className="text-center">
      <div className="relative min-h-82 overflow-hidden rounded-[22px_14px_24px_16px] border-2 border-[#17203a] bg-[#dff7e8] shadow-[6px_6px_0_#16815f]">
        <div className="absolute inset-x-0 bottom-0 h-12 bg-[#fff0b8] [background-image:linear-gradient(90deg,transparent_49%,rgb(23_32_58/.13)_50%,transparent_51%)] [background-size:48px_100%]" />
        {challenge.characters.map((character, index) => {
          const progress = reducedMotion
            ? 0.08 + ((index * 0.137) % 0.84)
            : Math.min(1, Math.max(0, (elapsed - character.delayMs) / character.durationMs));
          const x = character.direction === 1 ? -0.08 + progress * 1.16 : 1.08 - progress * 1.16;
          const visible = reducedMotion || (elapsed >= character.delayMs && progress < 1);
          return (
            <span
              key={character.id}
              className="absolute grid size-11 -translate-x-1/2 place-items-center rounded-[45%_55%_48%_52%] border-2 border-[#17203a] bg-[#ff8f73] text-xl font-black shadow-[3px_3px_0_#17203a] transition-[left] duration-100 motion-reduce:transition-none"
              style={{
                left: `${x * 100}%`,
                top: `${12 + character.lane * 18}%`,
                opacity: visible && !answering ? 1 : 0,
              }}
              aria-hidden="true"
            >
              {character.symbol}
            </span>
          );
        })}
        <strong
          className="absolute inset-0 grid place-content-center font-display text-[clamp(30px,6vw,58px)] font-[900] tracking-[-0.06em] text-[#17203a]"
          aria-live="polite"
        >
          {answering ? 'How many crossed?' : reducedMotion ? 'Count the beans' : 'Keep counting…'}
        </strong>
      </div>
      <fieldset className="mx-auto mt-5 grid max-w-xl grid-cols-4 gap-3" aria-label="Crowd count answers">
        {challenge.answerOptions.map((answer) => (
          <Button
            key={answer}
            className="h-16 font-display text-2xl"
            type="button"
            variant="paper"
            disabled={disabled || !answering}
            onClick={() => onSubmit({ kind: 'crowdCount', guess: answer })}
          >
            {answer}
          </Button>
        ))}
      </fieldset>
    </div>
  );
}

function DropZone({
  round,
  now,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  now: number;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'dropZone');
  const [releases, setReleases] = useState<number[]>([]);
  if (challenge === null) return null;
  const cycleDurationsMs = challenge.cycleDurationsMs;
  const attempt = Math.min(releases.length, cycleDurationsMs.length - 1);
  const duration = cycleDurationsMs[attempt] ?? 1_500;
  const cycle = ((Math.max(0, now - round.playStartsAt) % duration) / duration) * 2;
  const position = cycle <= 1 ? cycle : 2 - cycle;

  function release() {
    if (disabled || releases.length >= cycleDurationsMs.length) return;
    const next = [...releases, Math.round(position * 1_000) / 1_000];
    setReleases(next);
    if (next.length === cycleDurationsMs.length) onSubmit({ kind: 'dropZone', releasePositions: next });
  }

  return (
    <div className="text-center">
      <button
        type="button"
        className="relative block min-h-90 w-full overflow-hidden rounded-[22px_14px_24px_16px] border-2 border-[#17203a] bg-[#dfe9ff] shadow-[6px_6px_0_#3155d9] outline-none focus-visible:ring-4 focus-visible:ring-[#3155d9]/30"
        disabled={disabled || releases.length >= challenge.cycleDurationsMs.length}
        aria-label={`Release package ${attempt + 1} of ${challenge.cycleDurationsMs.length}`}
        onClick={release}
      >
        <span
          className="absolute top-5 -translate-x-1/2 text-6xl drop-shadow-[4px_4px_0_#17203a] transition-[left] duration-100 motion-reduce:transition-none"
          style={{ left: `${position * 100}%` }}
          aria-hidden="true"
        >
          📦
        </span>
        <span className="absolute inset-x-0 bottom-0 h-22 border-t-2 border-[#17203a] bg-[#82d9ac]" />
        <span
          className="absolute bottom-5 h-11 -translate-x-1/2 rounded-[10px_6px_11px_7px] border-3 border-[#17203a] bg-[#ffd85c] shadow-[4px_4px_0_#17203a]"
          style={{ left: `${challenge.targetCenter * 100}%`, width: `${challenge.targetWidth * 100}%` }}
          aria-hidden="true"
        />
        <strong className="absolute inset-x-0 bottom-29 font-display text-xl">Tap anywhere to drop</strong>
      </button>
      <p className="mt-4 mb-0 text-sm font-[800]" aria-live="polite">
        {releases.length} of {challenge.cycleDurationsMs.length} packages landed
      </p>
    </div>
  );
}

function ShadowMatch({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'shadowMatch');
  const [selected, setSelected] = useState<Array<number | null>>([null, null, null]);
  if (challenge === null) return null;

  function choose(cardIndex: number, optionIndex: number) {
    const next = selected.map((value, index) => (index === cardIndex ? optionIndex : value));
    setSelected(next);
    if (next.every((value) => value !== null)) {
      onSubmit({ kind: 'shadowMatch', selectedOptionIndices: next as number[] });
    }
  }

  return (
    <div className="grid grid-cols-3 gap-4 max-[680px]:grid-cols-1">
      {challenge.cards.map((card, cardIndex) => (
        <section
          key={card.targetShape}
          className="rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#f7f1ff] p-4 text-center shadow-[5px_5px_0_#cab9ef]"
        >
          <span
            className="mx-auto mb-4 grid size-24 place-items-center rounded-full border-2 border-[#17203a] bg-white text-6xl text-[#e85d2a] shadow-[3px_3px_0_#17203a]"
            role="img"
            aria-label={`${card.targetShape} object`}
          >
            {SHAPE_GLYPHS[card.targetShape] ?? '●'}
          </span>
          <fieldset className="grid grid-cols-2 gap-2" aria-label={`Silhouette choices for card ${cardIndex + 1}`}>
            {card.options.map((shape, optionIndex) => (
              <button
                key={shape}
                type="button"
                className={cn(
                  'grid aspect-square place-items-center rounded-lg border-2 border-[#17203a] bg-white text-4xl text-[#17203a] shadow-[3px_3px_0_#8894a9] outline-none focus-visible:ring-4 focus-visible:ring-[#3155d9]/35',
                  selected[cardIndex] === optionIndex && 'bg-[#ffd85c] shadow-[3px_3px_0_#e85d2a]'
                )}
                aria-label={`Choice ${optionIndex + 1}: ${shape}`}
                aria-pressed={selected[cardIndex] === optionIndex}
                disabled={disabled || selected[cardIndex] !== null}
                onClick={() => choose(cardIndex, optionIndex)}
              >
                {SHAPE_GLYPHS[shape] ?? '●'}
              </button>
            ))}
          </fieldset>
        </section>
      ))}
    </div>
  );
}

function FlagFrenzy({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'flagFrenzy');
  const [pressed, setPressed] = useState<number[]>([]);
  if (challenge === null) return null;
  const signals = challenge.signals;
  const currentSignal = signals[pressed.length] ?? null;

  function press(padId: number) {
    if (disabled || currentSignal === null) return;
    const next = [...pressed, padId];
    setPressed(next);
    if (next.length === signals.length) onSubmit({ kind: 'flagFrenzy', pressedPads: next });
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      <div
        className="mx-auto mb-6 grid size-36 place-items-center rounded-[28px_18px_30px_20px] border-3 border-[#17203a] bg-white text-7xl shadow-[7px_7px_0_#e85d2a]"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">
          {currentSignal === null ? 'Signals complete' : `${PAD_STYLES[currentSignal]?.label} signal`}
        </span>
        <span aria-hidden="true">{currentSignal === null ? '✓' : PAD_STYLES[currentSignal]?.symbol}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 max-[560px]:grid-cols-2">
        {PAD_STYLES.map((pad, padId) => (
          <button
            key={pad.label}
            type="button"
            className={cn(
              'aspect-square rounded-[18px_11px_20px_13px] border-2 border-[#17203a] text-5xl shadow-[5px_5px_0_#17203a] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-4 focus-visible:outline-[#3155d9]/35',
              pad.className
            )}
            aria-label={`${pad.label} signal pad`}
            disabled={disabled || currentSignal === null}
            onClick={() => press(padId)}
          >
            {pad.symbol}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs font-[760] text-[#68758b]">
        Signal {Math.min(pressed.length + 1, challenge.signals.length)} of {challenge.signals.length}
      </p>
    </div>
  );
}

function BrakeCheck({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'brakeCheck');
  const [releases, setReleases] = useState<number[]>([]);
  const [holdingAt, setHoldingAt] = useState<number | null>(null);
  const [meter, setMeter] = useState(0);
  const holdingAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (holdingAt === null || challenge === null) return;
    const interval = window.setInterval(
      () => setMeter(Math.min(1, (Date.now() - holdingAt) / challenge.fillDurationMs)),
      16
    );
    return () => window.clearInterval(interval);
  }, [challenge, holdingAt]);

  if (challenge === null) return null;
  const targets = challenge.targets;
  const fillDurationMs = challenge.fillDurationMs;
  const attempt = Math.min(releases.length, targets.length - 1);
  const target = targets[attempt] ?? 0.7;

  function startHold() {
    if (disabled || holdingAtRef.current !== null || releases.length >= targets.length) return;
    const startedAt = Date.now();
    holdingAtRef.current = startedAt;
    setHoldingAt(startedAt);
    setMeter(0);
  }

  function releaseHold() {
    const startedAt = holdingAtRef.current;
    if (startedAt === null) return;
    const value = Math.min(1, (Date.now() - startedAt) / fillDurationMs);
    holdingAtRef.current = null;
    setHoldingAt(null);
    setMeter(value);
    const next = [...releases, Math.round(value * 1_000) / 1_000];
    setReleases(next);
    if (next.length === targets.length) onSubmit({ kind: 'brakeCheck', releaseValues: next });
    else window.setTimeout(() => setMeter(0), 350);
  }

  function keyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) startHold();
  }

  function keyUp(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    releaseHold();
  }

  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="rounded-[22px_14px_24px_16px] border-2 border-[#17203a] bg-[#fff0b8] p-6 shadow-[6px_6px_0_#e85d2a]">
        <div className="relative h-28 overflow-hidden rounded-[18px_11px_20px_13px] border-3 border-[#17203a] bg-white p-2">
          <span
            className="absolute inset-y-0 z-2 w-1 -translate-x-1/2 bg-[#e85d2a]"
            style={{ left: `${target * 100}%` }}
            aria-hidden="true"
          />
          <span
            className="block h-full rounded-[10px_6px_11px_7px] bg-[#3155d9] transition-[width] duration-75 motion-reduce:transition-none"
            style={{ width: `${meter * 100}%` }}
          />
        </div>
        <p className="mt-4 font-display text-xl font-[850]">
          Attempt {Math.min(releases.length + 1, challenge.targets.length)} of {challenge.targets.length}
        </p>
        <button
          type="button"
          aria-label="Hold to accelerate · release to brake"
          className="mt-2 h-22 w-full touch-none rounded-[18px_11px_20px_13px] border-3 border-[#17203a] bg-[#ff8f73] font-display text-2xl font-[900] shadow-[6px_6px_0_#17203a] outline-none active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:ring-4 focus-visible:ring-[#3155d9]/35"
          disabled={disabled || releases.length >= challenge.targets.length}
          onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startHold();
          }}
          onPointerUp={releaseHold}
          onPointerCancel={releaseHold}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
        >
          Hold to accelerate · release to brake
        </button>
      </div>
    </div>
  );
}

function SignalSnap({
  round,
  now,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  now: number;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  const challenge = challengeFor(round, 'signalSnap');
  const [responses, setResponses] = useState<number[]>([]);
  if (challenge === null) return null;
  const cueOffsetsMs = challenge.cueOffsetsMs;
  const attempt = Math.min(responses.length, cueOffsetsMs.length - 1);
  const elapsed = Math.max(0, now - round.playStartsAt);
  const cue = cueOffsetsMs[attempt] ?? 10_000;
  const go = elapsed >= cue;

  function respond() {
    if (disabled || responses.length >= cueOffsetsMs.length) return;
    const next = [...responses, go ? Math.min(10_000, Math.round(Date.now() - round.playStartsAt)) : -1];
    setResponses(next);
    if (next.length === cueOffsetsMs.length) onSubmit({ kind: 'signalSnap', responseOffsetsMs: next });
  }

  return (
    <button
      type="button"
      className={cn(
        'grid min-h-100 w-full place-content-center rounded-[24px_15px_26px_17px] border-3 border-[#17203a] text-center shadow-[7px_7px_0_#17203a] outline-none transition-colors focus-visible:ring-4 focus-visible:ring-[#3155d9]/35 motion-reduce:transition-none',
        go ? 'bg-[#82d9ac]' : 'bg-[#ff8f73]'
      )}
      disabled={disabled || responses.length >= challenge.cueOffsetsMs.length}
      aria-label={go ? 'Signal changed. Tap now.' : 'Wait for the signal to change.'}
      onClick={respond}
    >
      <span className="text-8xl" aria-hidden="true">
        {go ? '⚡' : '✋'}
      </span>
      <strong className="mt-5 font-display text-[clamp(42px,8vw,78px)] leading-none font-[920] tracking-[-0.07em]">
        {go ? 'TAP!' : 'WAIT…'}
      </strong>
      <small className="mt-4 text-xs font-[800] uppercase">
        Signal {Math.min(responses.length + 1, challenge.cueOffsetsMs.length)} of {challenge.cueOffsetsMs.length}
      </small>
    </button>
  );
}

export default function NewMiniGameChallenge({
  round,
  now,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  now: number;
  disabled: boolean;
  onSubmit: (submission: NewMiniGameSubmission) => void;
}) {
  switch (round.miniGame.id) {
    case 'flashbackTiles':
      return <FlashbackTiles round={round} now={now} disabled={disabled} onSubmit={onSubmit} />;
    case 'copycatSequence':
      return <CopycatSequence round={round} now={now} disabled={disabled} onSubmit={onSubmit} />;
    case 'crowdCount':
      return <CrowdCount round={round} now={now} disabled={disabled} onSubmit={onSubmit} />;
    case 'dropZone':
      return <DropZone round={round} now={now} disabled={disabled} onSubmit={onSubmit} />;
    case 'shadowMatch':
      return <ShadowMatch round={round} disabled={disabled} onSubmit={onSubmit} />;
    case 'flagFrenzy':
      return <FlagFrenzy round={round} disabled={disabled} onSubmit={onSubmit} />;
    case 'brakeCheck':
      return <BrakeCheck round={round} disabled={disabled} onSubmit={onSubmit} />;
    case 'signalSnap':
      return <SignalSnap round={round} now={now} disabled={disabled} onSubmit={onSubmit} />;
    default:
      return null;
  }
}
