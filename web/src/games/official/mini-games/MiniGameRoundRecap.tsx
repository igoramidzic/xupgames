import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { Crosshair, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type GameView = FunctionReturnType<typeof api.miniGames.getGame>;
type MiniGameRound = NonNullable<GameView['round']>;
type RoundResult = GameView['roundResults'][number];

const PAD_GLYPHS = ['▲', '●', '■', '◆'] as const;
const CHART_COLORS = { coral: '#ee6b4d', gold: '#f5c84b', mint: '#63c99a', blue: '#5b82e8' } as const;
const SHAPE_GLYPHS: Record<string, string> = {
  star: '★',
  heart: '♥',
  moon: '☾',
  bolt: 'ϟ',
  diamond: '◆',
  flower: '✿',
};

function formatTime(timeMs: number | null) {
  if (timeMs === null) return '—';
  return `${(timeMs / 1_000).toFixed(1)}s`;
}

function resultDetail(result: RoundResult, round: MiniGameRound) {
  const miniGameId = round.miniGame.id;
  if (result.status === 'timedOut') return 'Time expired';
  if (miniGameId === 'straightLine')
    return `${Math.round(result.straightness ?? 0)}% straight · ${formatTime(result.timeMs)}`;
  if (miniGameId === 'orangeEmojis')
    return `${result.correctClicks} found · ${result.wrongClicks} wrong · ${formatTime(result.timeMs)}`;
  if (miniGameId === 'guessPercentage' || miniGameId === 'batteryPercentage')
    return `${result.numericGuess ?? 0}% guess · ${result.metric ?? 0} points off`;
  if (miniGameId === 'circleCenter') return `${result.metric ?? 0}% of a radius from center`;
  const detail = result.challengeResult;
  if (detail?.kind === 'flashbackTiles')
    return `${detail.correct} right · ${detail.wrong} wrong · ${detail.missed} missed`;
  if (detail?.kind === 'copycatSequence') return `${detail.correctPrefix} of ${detail.sequenceLength} steps`;
  if (detail?.kind === 'crowdCount') return `${detail.guess} guessed · ${detail.error} away`;
  if (detail?.kind === 'dropZone') return `${detail.averageError}% average miss · ${detail.perfectDrops} perfect`;
  if (detail?.kind === 'shadowMatch') return `${detail.correct} matches · ${detail.wrong} wrong`;
  if (detail?.kind === 'flagFrenzy') return `${detail.correct} signals · ${detail.bestStreak} best streak`;
  if (detail?.kind === 'brakeCheck') return `${detail.bestError}% from the line · ${detail.overshoots} overshot`;
  if (detail?.kind === 'signalSnap')
    return detail.medianMs === null
      ? `${detail.falseStarts} false starts`
      : `${detail.medianMs}ms median · ${detail.falseStarts} false starts`;
  return formatTime(result.timeMs);
}

type CurrentResult = GameView['currentResult'];
type ResultSubmission = NonNullable<NonNullable<CurrentResult>['submission']>;

function submissionFor<TKind extends ResultSubmission['kind']>(result: CurrentResult, kind: TKind) {
  const submission = result?.submission;
  return submission?.kind === kind ? (submission as Extract<ResultSubmission, { kind: TKind }>) : null;
}

function FeedbackLegend({ performance = false }: { performance?: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] font-[800] tracking-[0.08em] text-[#65738a] uppercase">
      <span className="inline-flex items-center gap-1.5">
        <i className={cn('size-2.5 rounded-full', performance ? 'bg-[#3155d9]' : 'bg-[#25a66f]')} />
        {performance ? 'Cue' : 'Correct'}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="size-2.5 rounded-full bg-[#e85d2a]" /> Your {performance ? 'tap' : 'different answer'}
      </span>
    </div>
  );
}

function StraightLineReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const target = round.lineTarget;
  const submission = submissionFor(result, 'straightLine');
  if (target === null) return null;
  const points = submission?.points.map((point) => `${point.x * 1000},${point.y * 560}`).join(' ') ?? '';
  return (
    <div>
      <svg
        className="mx-auto aspect-[16/9] w-full max-w-3xl rounded-2xl border-2 border-[#17203a] bg-[#fffdf5] shadow-[5px_5px_0_#b8c8e5]"
        viewBox="0 0 1000 560"
        role="img"
        aria-label="Your line and the direct path"
      >
        {points === '' ? null : (
          <polyline
            points={points}
            fill="none"
            stroke="#e85d2a"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".78"
          />
        )}
        <line
          x1={target.start.x * 1000}
          y1={target.start.y * 560}
          x2={target.end.x * 1000}
          y2={target.end.y * 560}
          stroke="#25a66f"
          strokeWidth="9"
          strokeDasharray="18 14"
          strokeLinecap="round"
        />
        <circle cx={target.start.x * 1000} cy={target.start.y * 560} r="18" fill="#3155d9" />
        <circle cx={target.end.x * 1000} cy={target.end.y * 560} r="18" fill="#25a66f" />
      </svg>
      <FeedbackLegend />
    </div>
  );
}

function EmojiReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const selected = new Set(submissionFor(result, 'orangeEmojis')?.clickedIds ?? []);
  const targetEmoji = round.targetEmoji;
  return (
    <div>
      <div
        className="relative mx-auto min-h-88 w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-[#17203a] bg-[#eef6ff] shadow-[5px_5px_0_#b8c8e5]"
        role="img"
        aria-label="Revealed emoji board"
      >
        {round.emojiItems.map((item) => {
          const correct = item.emoji === targetEmoji;
          const wrong = selected.has(item.id) && !correct;
          return (
            <span
              key={item.id}
              className={cn(
                'absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-2xl',
                correct && 'border-[#147e52] bg-[#c9f3df]',
                wrong && 'border-[#bd4933] bg-[#ffd8d0]',
                !correct && !wrong && 'border-transparent bg-white/60 opacity-45'
              )}
              style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
            >
              {item.emoji}
            </span>
          );
        })}
      </div>
      <FeedbackLegend />
    </div>
  );
}

function NumericReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const answer = round.numericAnswer;
  const guess = submissionFor(result, 'numericEstimate')?.guess ?? null;
  let cursor = 0;
  const gradient = round.percentageSegments
    .map((segment) => {
      const start = cursor;
      cursor += segment.percentage;
      return `${CHART_COLORS[segment.color]} ${start}% ${cursor}%`;
    })
    .join(', ');
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(180px,300px)_minmax(0,1fr)] items-center gap-8 rounded-2xl border-2 border-[#17203a] bg-[#f7f1ff] p-6 shadow-[5px_5px_0_#cab9ef] max-[620px]:grid-cols-1">
      {round.miniGame.id === 'guessPercentage' ? (
        <div
          className="mx-auto aspect-square w-full rounded-full border-8 border-white shadow-[0_0_0_3px_#17203a]"
          style={{ background: `conic-gradient(from -18deg, ${gradient})` }}
        />
      ) : (
        <div className="relative mx-auto h-30 w-full rounded-3xl border-6 border-[#17203a] bg-white p-2">
          <div className="h-full overflow-hidden rounded-2xl bg-[#e6ebf2]">
            <div className="h-full bg-[#53d889]" style={{ width: `${round.batteryPercentage ?? 0}%` }} />
          </div>
        </div>
      )}
      <div className="grid gap-3 text-center">
        <span className="text-[10px] font-[850] tracking-[0.12em] text-[#65738a] uppercase">Exact answer</span>
        <strong className="font-display text-6xl font-[920] text-[#25a66f]">
          {answer === null ? '—' : `${answer}%`}
        </strong>
        {guess === null || guess === answer ? null : (
          <strong className="font-display text-2xl font-[880] text-[#e85d2a]">You guessed {guess}%</strong>
        )}
      </div>
    </div>
  );
}

function CircleReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const target = round.circleTarget;
  const point = submissionFor(result, 'circleCenter')?.point ?? null;
  if (target === null) return null;
  return (
    <div>
      <div
        className="relative mx-auto aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-[#17203a] bg-[#fff6da] shadow-[5px_5px_0_#e2bf56]"
        role="img"
        aria-label="Your marker and the exact circle center"
      >
        <svg className="absolute inset-0 size-full" viewBox="0 0 1000 562" aria-hidden="true">
          <circle
            cx={target.center.x * 1000}
            cy={target.center.y * 562}
            r={target.radius * 562}
            fill="none"
            stroke="#17203a"
            strokeWidth="13"
            strokeDasharray="420 82 115 48"
            transform={`rotate(${target.gapRotation} ${target.center.x * 1000} ${target.center.y * 562})`}
          />
        </svg>
        {point === null ? null : (
          <span
            className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-3 border-white bg-[#e85d2a] shadow-[0_0_0_3px_#17203a]"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            data-answer-marker="player"
          />
        )}
        <Crosshair
          className="absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#25a66f] p-2 text-white shadow-[0_0_0_4px_#17203a]"
          style={{ left: `${target.center.x * 100}%`, top: `${target.center.y * 100}%` }}
          aria-label="Exact center"
          data-answer-marker="correct"
        />
      </div>
      <FeedbackLegend />
    </div>
  );
}

function FlashbackReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const challenge = round.challengePayload;
  if (challenge?.kind !== 'flashbackTiles') return null;
  const correct = new Set(challenge.targetTileIds);
  const selected = new Set(submissionFor(result, 'flashbackTiles')?.selectedTileIds ?? []);
  return (
    <div>
      <div
        className="mx-auto grid aspect-square w-[min(74vw,440px)] grid-cols-5 gap-2 rounded-2xl border-2 border-[#17203a] bg-[#dfe9ff] p-3 shadow-[7px_7px_0_#17203a]"
        role="img"
        aria-label="Revealed Flashback Tiles board"
      >
        {Array.from({ length: challenge.gridSize ** 2 }, (_, tileId) => ({ id: `tile-${tileId}`, tileId })).map(
          ({ id, tileId }) => {
            const isCorrect = correct.has(tileId);
            const isWrong = selected.has(tileId) && !isCorrect;
            return (
              <span
                key={id}
                className={cn(
                  'grid place-items-center rounded-lg border-2 border-[#17203a] bg-white text-sm font-black',
                  isCorrect && 'bg-[#70d6a6] text-[#103d2c]',
                  isWrong && 'bg-[#ff8f73] text-[#5b1d14]',
                  !isCorrect && !isWrong && 'opacity-55'
                )}
                data-tile-id={tileId}
                data-feedback={isCorrect ? 'correct' : isWrong ? 'wrong' : 'neutral'}
                data-selected={selected.has(tileId)}
              >
                {isCorrect ? '✓' : isWrong ? '×' : tileId + 1}
              </span>
            );
          }
        )}
      </div>
      <FeedbackLegend />
    </div>
  );
}

function SequenceReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const challenge = round.challengePayload;
  const correct =
    challenge?.kind === 'copycatSequence'
      ? challenge.sequence
      : challenge?.kind === 'flagFrenzy'
        ? challenge.signals
        : null;
  const selected =
    challenge?.kind === 'copycatSequence'
      ? submissionFor(result, 'copycatSequence')?.padIds
      : submissionFor(result, 'flagFrenzy')?.pressedPads;
  if (correct === null) return null;
  return (
    <div>
      <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2 rounded-2xl border-2 border-[#17203a] bg-white p-6 shadow-[5px_5px_0_#a9c6ff]">
        {correct
          .map((padId, index) => ({ id: `step-${index}`, index, padId }))
          .map(({ id, index, padId }) => {
            const chosen = selected?.[index];
            return (
              <div key={id} className="grid gap-1 text-center">
                <span className="grid size-15 place-items-center rounded-xl border-2 border-[#147e52] bg-[#c9f3df] text-2xl">
                  {PAD_GLYPHS[padId]}
                </span>
                {chosen === undefined || chosen === padId ? null : (
                  <span className="grid size-15 place-items-center rounded-xl border-2 border-[#bd4933] bg-[#ffd8d0] text-2xl">
                    {PAD_GLYPHS[chosen]}
                  </span>
                )}
              </div>
            );
          })}
      </div>
      <FeedbackLegend />
    </div>
  );
}

function CrowdReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const challenge = round.challengePayload;
  if (challenge?.kind !== 'crowdCount') return null;
  const guess = submissionFor(result, 'crowdCount')?.guess;
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border-2 border-[#17203a] bg-[#dff7e8] p-6 text-center shadow-[6px_6px_0_#16815f]">
      <div className="mb-5 flex flex-wrap justify-center gap-2" aria-hidden="true">
        {challenge.characters.map((character) => (
          <span
            key={character.id}
            className="grid size-9 place-items-center rounded-full border-2 border-[#17203a] bg-[#ff8f73]"
          >
            {character.symbol}
          </span>
        ))}
      </div>
      <strong className="font-display text-5xl text-[#25a66f]">{challenge.characters.length} crossed</strong>
      {guess === undefined || guess === challenge.characters.length ? null : (
        <p className="mt-3 mb-0 font-display text-2xl font-[850] text-[#e85d2a]">You guessed {guess}</p>
      )}
    </div>
  );
}

function MeterReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const challenge = round.challengePayload;
  const targets =
    challenge?.kind === 'dropZone'
      ? [challenge.targetCenter]
      : challenge?.kind === 'brakeCheck'
        ? challenge.targets
        : null;
  const values =
    challenge?.kind === 'dropZone'
      ? submissionFor(result, 'dropZone')?.releasePositions
      : submissionFor(result, 'brakeCheck')?.releaseValues;
  if (targets === null) return null;
  const targetRows = targets.map((target, index) => ({ id: `target-${index}`, index, target }));
  return (
    <div>
      <div className="mx-auto grid max-w-3xl gap-5 rounded-2xl border-2 border-[#17203a] bg-[#fff0b8] p-7 shadow-[5px_5px_0_#e2bf56]">
        {targetRows.map(({ id, index, target }) => {
          const rowValues = challenge?.kind === 'dropZone' ? (values ?? []) : [values?.[index]];
          return (
            <div key={id} className="relative h-16 rounded-xl border-2 border-[#17203a] bg-white">
              <span
                className="absolute inset-y-0 w-2 -translate-x-1/2 bg-[#25a66f]"
                style={{ left: `${target * 100}%` }}
              />
              {rowValues.map((value) =>
                value === undefined || Math.abs(value - target) < 0.001 ? null : (
                  <span
                    key={`answer-${value}`}
                    className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e85d2a] shadow-[0_0_0_3px_#17203a]"
                    style={{ left: `${value * 100}%` }}
                  />
                )
              )}
            </div>
          );
        })}
      </div>
      <FeedbackLegend />
    </div>
  );
}

function ShadowReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const challenge = round.challengePayload;
  if (challenge?.kind !== 'shadowMatch') return null;
  const selected = submissionFor(result, 'shadowMatch')?.selectedOptionIndices ?? [];
  return (
    <div>
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-3 max-[620px]:grid-cols-1">
        {challenge.cards.map((card, cardIndex) => (
          <div key={card.targetShape} className="rounded-xl border-2 border-[#17203a] bg-white p-3 text-center">
            <strong className="mb-3 block text-4xl">{SHAPE_GLYPHS[card.targetShape]}</strong>
            <div className="grid grid-cols-2 gap-1">
              {card.options.map((option, optionIndex) => {
                const correct = option === card.targetShape;
                const wrong = selected[cardIndex] === optionIndex && !correct;
                return (
                  <span
                    key={option}
                    className={cn(
                      'grid min-h-10 place-items-center rounded-lg border text-xl',
                      correct && 'border-[#147e52] bg-[#c9f3df]',
                      wrong && 'border-[#bd4933] bg-[#ffd8d0]',
                      !correct && !wrong && 'border-[#d4dce7] opacity-45'
                    )}
                  >
                    {SHAPE_GLYPHS[option]}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <FeedbackLegend />
    </div>
  );
}

function SignalReplay({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const challenge = round.challengePayload;
  if (challenge?.kind !== 'signalSnap') return null;
  const taps = submissionFor(result, 'signalSnap')?.responseOffsetsMs ?? [];
  return (
    <div>
      <div
        className="relative mx-auto h-36 max-w-3xl rounded-2xl border-2 border-[#17203a] bg-[#eef2ff] px-6 shadow-[5px_5px_0_#a9c6ff]"
        role="img"
        aria-label="Signal cues and your tap timing"
      >
        <span className="absolute top-1/2 right-6 left-6 h-1 -translate-y-1/2 bg-[#b7c3d8]" />
        {challenge.cueOffsetsMs.map((cue, index) => (
          <span
            key={`cue-${cue}`}
            className="absolute top-7 h-20 w-1.5 -translate-x-1/2 bg-[#3155d9]"
            style={{ left: `${6 + (cue / 10_000) * 88}%` }}
          >
            <small className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#3155d9]">
              CUE {index + 1}
            </small>
          </span>
        ))}
        {taps.map((tap, index) =>
          tap < 0 ? null : (
            <span
              key={`tap-${challenge.cueOffsetsMs[index] ?? 'missed'}-${tap}`}
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e85d2a] shadow-[0_0_0_3px_#17203a]"
              style={{ left: `${6 + (tap / 10_000) * 88}%` }}
            />
          )
        )}
      </div>
      <FeedbackLegend performance />
      <p className="mt-3 mb-0 text-center text-sm font-[760] text-[#65738a]">
        There is no correct tap—only your reaction time after each cue.
      </p>
    </div>
  );
}

function RoundReplayBoard({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  switch (round.miniGame.id) {
    case 'straightLine':
      return <StraightLineReplay round={round} result={result} />;
    case 'orangeEmojis':
      return <EmojiReplay round={round} result={result} />;
    case 'guessPercentage':
    case 'batteryPercentage':
      return <NumericReplay round={round} result={result} />;
    case 'circleCenter':
      return <CircleReplay round={round} result={result} />;
    case 'flashbackTiles':
      return <FlashbackReplay round={round} result={result} />;
    case 'copycatSequence':
    case 'flagFrenzy':
      return <SequenceReplay round={round} result={result} />;
    case 'crowdCount':
      return <CrowdReplay round={round} result={result} />;
    case 'dropZone':
    case 'brakeCheck':
      return <MeterReplay round={round} result={result} />;
    case 'shadowMatch':
      return <ShadowReplay round={round} result={result} />;
    case 'signalSnap':
      return <SignalReplay round={round} result={result} />;
  }
}

export function MiniGameAnswerReveal({ round, result }: { round: MiniGameRound; result: CurrentResult }) {
  const performanceOnly = round.miniGame.id === 'signalSnap';
  return (
    <section
      className="min-h-[clamp(390px,calc(100dvh-300px),580px)] px-[clamp(16px,4vw,40px)] py-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
      aria-label="Round replay"
      aria-live="polite"
    >
      <div className="mb-5 text-center">
        <p className="mb-1 text-[9px] font-[850] tracking-[0.14em] text-[#3155d9] uppercase">Round replay</p>
        <h2 className="m-0 font-display text-[clamp(26px,4vw,38px)] leading-none font-[900] tracking-[-0.05em]">
          {performanceOnly ? 'Here’s your tap timing' : 'Here’s how it lined up'}
        </h2>
      </div>
      <RoundReplayBoard round={round} result={result} />
    </section>
  );
}

export function MiniGameRoundPodium({ game }: { game: GameView }) {
  const round = game.round;
  if (round === null) return null;
  const podium = game.roundResults.filter((result) => result.status !== 'waiting').slice(0, 3);
  const standingByMemberId = new Map(game.standings.map((standing) => [standing.memberId, standing]));

  return (
    <section className="min-h-[clamp(390px,calc(100dvh-300px),580px)] p-[clamp(18px,4vw,40px)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-400">
      <div className="mx-auto max-w-205">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[9px] font-[850] tracking-[0.14em] text-[#3155d9] uppercase">Round podium</p>
            <h2 className="m-0 font-display text-[clamp(28px,5vw,42px)] leading-none font-[900] tracking-[-0.055em]">
              Top players this game
            </h2>
          </div>
          <Trophy className="size-8 shrink-0 text-[#d0a018]" aria-hidden="true" />
        </div>
        {podium.length === 0 ? (
          <p className="rounded-[14px_9px_16px_11px] border border-[#c7d2e2] bg-white px-4 py-8 text-center text-sm text-[#78869a] shadow-[0_3px_0_#dce4ef]">
            No player finished this mini-game before time ran out.
          </p>
        ) : (
          <ol
            className="m-0 grid list-none grid-cols-3 gap-2 p-0 max-[620px]:grid-cols-1"
            aria-label="Top players this round"
          >
            {podium.map((result, index) => {
              const standing = standingByMemberId.get(result.memberId);
              return (
                <li
                  key={result.memberId}
                  className={cn(
                    'grid min-h-38 content-between rounded-[16px_10px_18px_12px] border border-[#c7d2e2] bg-white p-4 shadow-[0_4px_0_#dce4ef]',
                    index === 0 && 'border-[#d0a018] bg-[#fff8d7]',
                    result.isCurrentPlayer && 'ring-2 ring-[#3155d9]/35'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-[#17203a] text-xs font-[850] text-white">
                      {index + 1}
                    </span>
                    <strong className="font-display text-2xl font-[900] text-[#e85d2a] tabular-nums">
                      +{result.score.toLocaleString()}
                    </strong>
                  </div>
                  <div className="mt-4 min-w-0">
                    <strong className="block truncate text-sm text-[#24334c]">
                      {result.displayName}
                      {result.isCurrentPlayer ? ' (you)' : ''}
                    </strong>
                    <small className="mt-1 block text-[10px] leading-4 text-[#78869a]">
                      {resultDetail(result, round)}
                    </small>
                    {standing === undefined ? null : (
                      <small className="mt-2 block text-[9px] font-[820] tracking-[0.08em] text-[#3155d9] uppercase">
                        #{standing.rank} overall
                      </small>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-5 mb-0 text-center text-xs font-[720] text-[#748095]">
          The overall standings have updated in the sidebar.
        </p>
      </div>
    </section>
  );
}
