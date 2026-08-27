import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CircleDot,
  Clock3,
  Copy,
  DoorOpen,
  Gamepad2,
  Gauge,
  LoaderCircle,
  Medal,
  Play,
  Send,
  Sparkles,
  Trophy,
  UsersRound,
  WandSparkles,
  Wrench,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameModeControl, { GameModeContent } from '@/components/GameModeControl';
import GameSurfaceTransition from '@/components/GameSurfaceTransition';
import LobbyPlayersSidebar, { type LobbyPlayersSidebarTheme } from '@/components/LobbyPlayersSidebar';
import PostGameBoard, { PostGamePodium } from '@/components/PostGameBoard';
import RoomHeaderActions from '@/components/RoomHeaderActions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  GAME_LOBBY_CARD_HEIGHT_CLASS,
  GAME_LOBBY_FRAME_CLASS,
  GAME_LOBBY_GRID_CLASS,
  GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS,
} from '@/lib/gameLobbyLayout';
import type { GuestIdentity } from '@/lib/guest';
import { getRoomMembers } from '@/lib/roomSession';
import { useListReorderAnimation } from '@/lib/useListReorderAnimation';
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import GeneratedGameFrame, { type GeneratedGameFinish, prefetchGeneratedGame } from './GeneratedGameFrame';
import PromptArcadeGameShowcase from './PromptArcadeGameShowcase';
import PromptArcadeRatingPanel from './PromptArcadeRatingPanel';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type GameView = FunctionReturnType<typeof api.promptArcade.getGame>;
type PromptEntry = GameView['entries'][number];
type EntryStatus = PromptEntry['status'];
type RoundId = NonNullable<GameView['round']>['roundId'];
type FailedFinish = { roundId: RoundId; result: GeneratedGameFinish };

const PROMPT_MAX_LENGTH = 1_000;
const BUILD_STEPS = 4;
const AUTHOR_SPOTLIGHT_MS = 2_400;
const GAME_DETAILS_SPOTLIGHT_MS = 5_200;
const PROMPT_ARCADE_LOBBY_SIDEBAR_THEME: LobbyPlayersSidebarTheme = {
  background: '#ecebff',
  border: '#aaa8cf',
  shadow: '5px 6px 0 rgb(90 81 215 / 14%)',
  text: '#26334d',
  mutedText: '#6f7086',
  eyebrow: '#564dd8',
  divider: '#c4c3df',
  countBackground: '#dad7ff',
  countText: '#4d45bd',
  currentPlayerBackground: '#f8f7ff',
  avatarBackground: '#ffd75a',
  avatarBorder: '#17203a',
  avatarText: '#17203a',
  avatarShadow: '2px 2px 0 rgb(23 32 58 / 18%)',
  inviteBackground: '#ffffff',
  inviteHoverBackground: '#f8f7ff',
  inviteBorder: '#aaa8cf',
  inviteText: '#5148c5',
};
const STATUS_PRESENTATION: Record<
  EntryStatus,
  { label: string; shortLabel: string; step: number; tone: string; dotTone: string; icon: typeof CircleDot }
> = {
  writing: {
    label: 'Writing a prompt',
    shortLabel: 'Writing',
    step: 0,
    tone: 'border-[#bdc7d8] bg-[#f7f9fc] text-[#68758b]',
    dotTone: 'border-[#8e9bb0] bg-[#bcc6d5] text-[#26334d]',
    icon: CircleDot,
  },
  queued: {
    label: 'Waiting for a builder',
    shortLabel: 'Queued',
    step: 1,
    tone: 'border-[#d2b844] bg-[#fff7c9] text-[#79650d]',
    dotTone: 'border-[#a98d13] bg-[#f3d95f] text-[#4d4105]',
    icon: Clock3,
  },
  generating: {
    label: 'Building the game',
    shortLabel: 'Building',
    step: 2,
    tone: 'border-[#6e67da] bg-[#eeebff] text-[#5148c5]',
    dotTone: 'border-[#5c52cc] bg-[#9288ef] text-white motion-safe:animate-pulse',
    icon: WandSparkles,
  },
  validating: {
    label: 'Checking the game',
    shortLabel: 'Checking',
    step: 3,
    tone: 'border-[#31a59b] bg-[#e3f8f4] text-[#197f77]',
    dotTone: 'border-[#277fa0] bg-[#69c4e5] text-[#123b4d]',
    icon: Gauge,
  },
  repairing: {
    label: 'Repairing the game',
    shortLabel: 'Repairing',
    step: 3,
    tone: 'border-[#e18449] bg-[#fff0df] text-[#a84f25]',
    dotTone: 'border-[#bc5f2d] bg-[#f1a068] text-[#5b2c14] motion-safe:animate-pulse',
    icon: Wrench,
  },
  ready: {
    label: 'Ready to play',
    shortLabel: 'Ready',
    step: 4,
    tone: 'border-[#249780] bg-[#dff7ed] text-[#15705f]',
    dotTone: 'border-[#20816c] bg-[#65d6b8] text-[#103f36]',
    icon: Check,
  },
  needsRevision: {
    label: 'Needs a new prompt',
    shortLabel: 'Revise',
    step: 0,
    tone: 'border-[#d26c55] bg-[#fff0ea] text-[#a34430]',
    dotTone: 'border-[#b9533e] bg-[#f39a83] text-[#5f2418]',
    icon: AlertTriangle,
  },
  withdrawn: {
    label: 'Player left before building',
    shortLabel: 'Withdrawn',
    step: 0,
    tone: 'border-[#c4cad4] bg-[#eef0f4] text-[#70798a]',
    dotTone: 'border-[#626d7f] bg-[#7f8999] text-white',
    icon: DoorOpen,
  },
  played: {
    label: 'Played',
    shortLabel: 'Played',
    step: 4,
    tone: 'border-[#4d60a8] bg-[#e9edff] text-[#3c4d92]',
    dotTone: 'border-[#344783] bg-[#586cae] text-white',
    icon: Gamepad2,
  },
};

function useClock(enabled: boolean, intervalMs = 100) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs]);
  return now;
}

function formatPoints(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatSeconds(milliseconds: number) {
  return `${Math.max(0, Math.ceil(milliseconds / 1_000))}s`;
}

function normalizePrompt(value: string) {
  return value.normalize('NFKC').trim();
}

function promptError(value: string) {
  const prompt = normalizePrompt(value);
  if (prompt.length === 0) return 'Describe a mini-game before sending it to the builder.';
  if (Array.from(prompt).length > PROMPT_MAX_LENGTH) return `Keep the prompt to ${PROMPT_MAX_LENGTH} characters.`;
  for (const character of prompt) {
    if (character !== '\t' && character !== '\n' && character !== '\r' && /\p{Cc}/u.test(character)) {
      return 'Remove control characters from the prompt.';
    }
  }
  return null;
}

function StatusBadge({ status }: { status: EntryStatus }) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-[9px] leading-none font-[850] tracking-[0.08em] uppercase',
        presentation.tone
      )}
    >
      <Icon
        className={cn('size-3', (status === 'generating' || status === 'repairing') && 'motion-safe:animate-pulse')}
        aria-hidden="true"
      />
      {presentation.shortLabel}
    </span>
  );
}

function BuildSteps({ status, name }: { status: EntryStatus; name: string }) {
  const step = STATUS_PRESENTATION[status].step;
  return (
    <div
      className="grid grid-cols-4 gap-1"
      role="progressbar"
      aria-label={`${name}: ${STATUS_PRESENTATION[status].label}`}
      aria-valuemin={0}
      aria-valuemax={BUILD_STEPS}
      aria-valuenow={step}
    >
      {[1, 2, 3, 4].map((index) => (
        <span
          className={cn(
            'h-1.5 rounded-full border border-[#ccd4e2] bg-[#e7ebf2]',
            index <= step && 'border-[#544bd4] bg-[#6f67e1]',
            status === 'needsRevision' && 'border-[#df8a76] bg-[#ef9b84]',
            status === 'played' && index <= step && 'border-[#40528f] bg-[#586cae]'
          )}
          key={index}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function PlayerCartridge({ entry }: { entry: PromptEntry }) {
  return (
    <li
      className={cn(
        'grid min-w-0 gap-2 rounded-[13px_8px_14px_9px] border border-[#bcc7d8] bg-white px-3 py-3 shadow-[0_3px_0_#d7deea]',
        entry.isCurrentPlayer && 'border-[#5a51d7] bg-[#f5f3ff] shadow-[0_3px_0_#5a51d7]',
        !entry.isActive && 'opacity-55 grayscale'
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[#26334d]">
            {entry.displayName} {entry.isCurrentPlayer ? '(you)' : ''}
          </strong>
          <span className="mt-0.5 block overflow-hidden text-[9px] text-ellipsis whitespace-nowrap text-[#7d8798]">
            {entry.artifactTitle ?? (entry.prompt === null ? 'Empty cartridge' : entry.prompt)}
          </span>
        </div>
        <StatusBadge status={entry.status} />
      </div>
      <BuildSteps status={entry.status} name={entry.displayName} />
    </li>
  );
}

function PlayerBuildRoster({ entries }: { entries: GameView['entries'] }) {
  return (
    <div className="border-b border-[#26324a] bg-[#37435b] px-3 py-3">
      <ol
        className="m-0 flex list-none flex-wrap gap-1.5 p-0"
        aria-label={`Build status for ${entries.length} ${entries.length === 1 ? 'player' : 'players'}`}
      >
        {entries.map((entry, index) => (
          <li
            className={cn(
              'grid size-5.5 shrink-0 place-items-center rounded-full border text-[8px] leading-none font-[900] tabular-nums shadow-[0_1px_0_rgb(0_0_0/24%)]',
              STATUS_PRESENTATION[entry.status].dotTone
            )}
            key={entry.entryId}
            aria-label={`${index + 1}. ${entry.displayName}: ${STATUS_PRESENTATION[entry.status].label}`}
            title={`${entry.displayName}: ${STATUS_PRESENTATION[entry.status].label}`}
          >
            {index + 1}
          </li>
        ))}
      </ol>
    </div>
  );
}

function FactoryPlayersSidebar({
  game,
  copied,
  startingPlaylist,
  onInvite,
  onStartPlaylist,
}: {
  game: GameView;
  copied: boolean;
  startingPlaylist: boolean;
  onInvite: () => void;
  onStartPlaylist?: () => void;
}) {
  const readyCount = game.summary.ready + game.summary.played;
  const workingCount = game.summary.queued + game.summary.generating + game.summary.validating + game.summary.repairing;
  const allReady = game.requiredReadyCount > 0 && readyCount >= game.requiredReadyCount;
  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-[17px_11px_19px_13px] border border-[#aaa8cf] bg-[#ecebff] shadow-[5px_6px_0_rgb(90_81_215/14%)] max-[820px]:h-auto max-[820px]:max-h-160',
        GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS
      )}
      aria-label="Prompt Arcade players"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#c4c3df] bg-white/45 px-4 py-4">
        <div>
          <p className="mb-0.5 text-[9px] font-[850] tracking-[0.13em] text-[#564dd8] uppercase">Factory floor</p>
          <h2 className="m-0 font-display text-xl font-[850] tracking-[-0.04em]">Players</h2>
        </div>
        <span className="inline-flex items-center gap-1.25 rounded-full bg-[#dad7ff] px-2.5 py-1.5 text-xs font-[780] text-[#4d45bd]">
          <UsersRound className="size-3.5" aria-hidden="true" /> {game.participantCount}
        </span>
      </div>
      <PlayerBuildRoster entries={game.entries} />
      <div className="flex items-center justify-between gap-2 border-b border-[#c4c3df] px-4 py-2.5 text-[10px] font-[760] text-[#6f7086]">
        <span>
          {readyCount} of {game.requiredReadyCount} ready
        </span>
        <span>{workingCount > 0 ? `${workingCount} building` : allReady ? 'Starting…' : 'Waiting on prompts'}</span>
      </div>
      <ol className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-3">
        {game.entries.map((entry) => (
          <PlayerCartridge entry={entry} key={entry.entryId} />
        ))}
      </ol>
      {!game.playlistStarted ? (
        <div className="border-t border-[#c4c3df] px-3 pt-3">
          {allReady ? (
            <p
              className="m-0 flex items-center gap-2 rounded-[10px_7px_11px_8px] bg-[#dff7ed] px-3 py-2.5 text-xs font-[750] text-[#15705f]"
              role="status"
            >
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Everyone is ready. Starting automatically…
            </p>
          ) : game.isOwner ? (
            <Button
              className="w-full"
              type="button"
              onClick={onStartPlaylist}
              disabled={!game.canStartPlaylist || startingPlaylist}
            >
              {startingPlaylist ? (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              Start early{readyCount > 0 ? ` with ${readyCount} ready` : ''}
            </Button>
          ) : (
            <p className="m-0 text-xs leading-[1.45] text-[#6f7086]">
              The playlist starts automatically when every player-made game is ready.
            </p>
          )}
        </div>
      ) : null}
      <Button
        className="m-3 inline-flex h-10 w-[calc(100%-24px)] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#aaa8cf] bg-white px-3 text-xs font-[760] text-[#5148c5] enabled:hover:border-[#aaa8cf] enabled:hover:bg-[#f8f7ff] enabled:hover:text-[#5148c5] [&_svg]:size-4"
        type="button"
        onClick={onInvite}
        variant="paper"
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Link copied' : 'Invite more players'}
      </Button>
    </aside>
  );
}

function PromptComposer({
  entry,
  onSubmit,
  onRetry,
}: {
  entry: PromptEntry;
  onSubmit: (prompt: string) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  const [value, setValue] = useState(entry.status === 'needsRevision' ? (entry.prompt ?? '') : '');
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canWrite = entry.status === 'writing' || entry.status === 'needsRevision';
  const generationPending =
    entry.status === 'queued' ||
    entry.status === 'generating' ||
    entry.status === 'validating' ||
    entry.status === 'repairing';
  const retryClock = useClock(generationPending, 1_000);
  const canRetry = generationPending && entry.retryAvailableAt !== null && retryClock >= entry.retryAvailableAt;

  useEffect(() => {
    if (entry.status === 'needsRevision') setValue(entry.prompt ?? '');
  }, [entry.prompt, entry.status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || submitting) return;
    const validationError = promptError(value);
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(normalizePrompt(value));
    } catch (submitError) {
      setError(userFacingError(submitError, 'Your prompt could not be sent to the builder.'));
      setSubmitting(false);
    }
  }

  async function handleRetry() {
    if (!canRetry || retrying) return;
    setRetrying(true);
    setError(null);
    try {
      await onRetry();
    } catch (retryError) {
      setError(userFacingError(retryError, 'The game could not be sent back to the builder.'));
      setRetrying(false);
    }
  }

  if (!canWrite) {
    return (
      <section
        className="rounded-[18px_12px_20px_14px] border-2 border-[#17203a] bg-[#fffaf0] p-5 shadow-[6px_6px_0_#17203a]"
        aria-label="Your mini-game prompt"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[9px] font-[850] tracking-[0.14em] text-[#564dd8] uppercase">Your cartridge</p>
            <h2 className="m-0 font-display text-2xl font-[880] tracking-[-0.045em]">Prompt locked.</h2>
          </div>
          <StatusBadge status={entry.status} />
        </div>
        <blockquote className="mt-4 mb-0 rounded-[12px_8px_13px_9px] border border-[#d4d9e4] bg-white px-4 py-3 text-sm leading-[1.5] text-[#4e5a70]">
          “{entry.prompt}”
        </blockquote>
        <p className="mt-3 mb-0 text-xs leading-[1.45] text-[#748095]">
          {STATUS_PRESENTATION[entry.status].label}. You can watch it move through the factory below.
        </p>
        {canRetry ? (
          <Button className="mt-4" variant="paper" size="sm" type="button" onClick={handleRetry} disabled={retrying}>
            {retrying ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Wrench aria-hidden="true" />
            )}
            Send back to builder
          </Button>
        ) : null}
        {error !== null ? (
          <p className="mt-3 mb-0 text-xs font-[700] text-[#b44b38]" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form
      className="rounded-[18px_12px_20px_14px] border-2 border-[#17203a] bg-[#fffaf0] p-5 shadow-[6px_6px_0_#17203a]"
      onSubmit={handleSubmit}
      aria-labelledby="prompt-composer-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[9px] font-[850] tracking-[0.14em] text-[#564dd8] uppercase">
            {entry.status === 'needsRevision' ? 'Back to the workbench' : 'Build one game'}
          </p>
          <h2
            className="m-0 font-display text-[clamp(25px,4vw,36px)] leading-none font-[890] tracking-[-0.055em]"
            id="prompt-composer-title"
          >
            {entry.status === 'needsRevision' ? 'Give the builder a clearer idea.' : 'What should everyone play?'}
          </h2>
        </div>
        <span className="grid size-10 shrink-0 -rotate-2 place-items-center rounded-[13px_8px_14px_9px] border-2 border-[#17203a] bg-[#ffd75a] shadow-[3px_3px_0_#17203a]">
          <WandSparkles className="size-4.5 text-[#564dd8]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 mb-0 max-w-180 text-sm leading-[1.5] text-[#687389]">
        Describe the interaction and the win condition. Every player&apos;s prompt gets its own game.
      </p>
      {entry.errorMessage !== null ? (
        <p
          className="mt-4 mb-0 rounded-[10px_7px_11px_8px] border border-[#e6a08e] bg-[#fff0ea] px-3 py-2.5 text-xs leading-[1.45] text-[#9b412e]"
          role="alert"
        >
          {entry.errorMessage}
        </p>
      ) : null}
      <label className="mt-5 block" htmlFor="prompt-arcade-prompt">
        <span className="sr-only">Mini-game prompt</span>
        <textarea
          className="min-h-31 w-full resize-y rounded-[13px_9px_14px_10px] border-2 border-[#aeb9ca] bg-white px-4 py-3 text-base leading-[1.5] text-[#17203a] outline-none shadow-[0_4px_0_#d3dae6] placeholder:text-[#939cad] focus:border-[#564dd8] focus:ring-3 focus:ring-[#564dd8]/20"
          id="prompt-arcade-prompt"
          value={value}
          onChange={(event) => setValue(Array.from(event.target.value).slice(0, PROMPT_MAX_LENGTH).join(''))}
          placeholder="First player to draw a nearly perfect circle wins."
          disabled={submitting}
          aria-describedby="prompt-arcade-hint prompt-arcade-error"
        />
      </label>
      <div className="mt-2 flex items-start justify-between gap-3 text-[10px] text-[#7c8799]" id="prompt-arcade-hint">
        <span>Interaction + goal is enough. The builder handles the rest.</span>
        <span className="shrink-0 tabular-nums">
          {Array.from(value).length}/{PROMPT_MAX_LENGTH}
        </span>
      </div>
      {error !== null ? (
        <p className="mt-3 mb-0 text-xs font-[700] text-[#b44b38]" id="prompt-arcade-error" role="alert">
          {error}
        </p>
      ) : (
        <span className="sr-only" id="prompt-arcade-error">
          Prompt is ready for validation.
        </span>
      )}
      <Button className="mt-5 w-full sm:w-auto" type="submit" size="lg" disabled={submitting}>
        {submitting ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Send aria-hidden="true" />
        )}
        {entry.status === 'needsRevision' ? 'Rebuild my game' : 'Build my game'}
      </Button>
    </form>
  );
}

function FactorySurface({
  game,
  onSubmitPrompt,
  onRetryGeneration,
  onStartPlaylist,
  copied,
  onInvite,
  startingPlaylist,
}: {
  game: GameView;
  onSubmitPrompt: (prompt: string) => Promise<void>;
  onRetryGeneration: () => Promise<void>;
  onStartPlaylist: () => void;
  copied: boolean;
  onInvite: () => void;
  startingPlaylist: boolean;
}) {
  const currentEntry = game.entries.find((entry) => entry.isCurrentPlayer) ?? null;
  return (
    <main className={cn(GAME_LOBBY_FRAME_CLASS, GAME_LOBBY_GRID_CLASS)}>
      <section className="min-w-0">
        {currentEntry === null ? (
          <section
            className="grid min-h-64 place-content-center rounded-[18px_12px_20px_14px] border border-[#c6cfdd] bg-white p-6 text-center shadow-[0_4px_0_#d7deea]"
            role="status"
          >
            {game.participantCount >= 30 ? (
              <>
                <Gamepad2 className="mx-auto mb-3 size-7 text-[#564dd8]" aria-hidden="true" />
                <strong className="font-display text-xl font-[850]">
                  The factory is full. You&apos;re spectating.
                </strong>
                <span className="mx-auto mt-2 max-w-100 text-xs leading-[1.45] text-[#748095]">
                  All 30 player cartridges were locked before you joined. You can watch this playlist and join the next
                  game.
                </span>
              </>
            ) : (
              <>
                <LoaderCircle
                  className="mx-auto mb-3 size-6 animate-spin text-[#564dd8] motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <strong className="font-display text-xl font-[850]">Preparing your cartridge…</strong>
              </>
            )}
          </section>
        ) : (
          <PromptComposer entry={currentEntry} onSubmit={onSubmitPrompt} onRetry={onRetryGeneration} />
        )}
      </section>
      <FactoryPlayersSidebar
        game={game}
        copied={copied}
        startingPlaylist={startingPlaylist}
        onInvite={onInvite}
        onStartPlaylist={onStartPlaylist}
      />
    </main>
  );
}

function LobbySurface({
  game,
  members,
  activeMemberCount,
  currentMemberId,
  onlineByMemberId,
  copied,
  starting,
  onStart,
  onInvite,
}: {
  game: GameView;
  members: ReturnType<typeof getRoomMembers>;
  activeMemberCount: number;
  currentMemberId: string;
  onlineByMemberId: ReadonlyMap<string, boolean>;
  copied: boolean;
  starting: boolean;
  onStart: () => void;
  onInvite: () => void;
}) {
  const overPlayerLimit = activeMemberCount > 30;
  return (
    <main className={cn(GAME_LOBBY_FRAME_CLASS, GAME_LOBBY_GRID_CLASS)}>
      <section
        className={cn(
          'relative flex flex-col justify-center overflow-hidden rounded-[25px_16px_27px_18px] border-2 border-[#17203a] bg-[#f8f9ff] p-[clamp(28px,6vw,76px)] shadow-[8px_9px_0_#a9dfdc] max-[520px]:p-6',
          GAME_LOBBY_CARD_HEIGHT_CLASS
        )}
      >
        <span className="absolute top-8 right-8 grid size-14 rotate-5 place-items-center rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#ffd75a] shadow-[4px_4px_0_#17203a] max-[520px]:top-5 max-[520px]:right-5 max-[520px]:size-11">
          <WandSparkles className="size-6 text-[#564dd8]" aria-hidden="true" />
        </span>
        <p className="mb-3 text-[10px] font-[880] tracking-[0.16em] text-[#564dd8] uppercase">
          Prompt Arcade · Live game factory
        </p>
        <h1 className="m-0 max-w-190 font-display text-[clamp(48px,8vw,92px)] leading-[0.84] font-[930] tracking-[-0.075em] text-[#17203a]">
          Make a game.
          <br />
          Then play <span className="text-[#ef7543]">all of them.</span>
        </h1>
        <p className="mt-6 mb-0 max-w-155 text-[clamp(14px,2vw,17px)] leading-[1.55] text-[#657087]">
          Everyone writes one mini-game idea. The factory builds every prompt, then play starts automatically when all
          of them are ready.
        </p>
        <div className="mt-8">
          {game.isOwner ? (
            <>
              <Button
                type="button"
                size="xl"
                onClick={onStart}
                disabled={starting || activeMemberCount === 0 || overPlayerLimit}
              >
                {starting ? (
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
                Start game
              </Button>
              {overPlayerLimit ? (
                <p className="mt-4 mb-0 max-w-130 text-sm font-[720] text-[#a34430]" role="alert">
                  Prompt Arcade supports 30 active players. Ask {activeMemberCount - 30}{' '}
                  {activeMemberCount - 30 === 1 ? 'player' : 'players'} to leave before starting.
                </p>
              ) : null}
            </>
          ) : (
            <p className="m-0 inline-flex items-center gap-2 rounded-full border border-[#c4ccda] bg-white px-4 py-2.5 text-sm font-[730] text-[#627087]">
              <Clock3 className="size-4 text-[#564dd8]" aria-hidden="true" /> Waiting for the room owner
            </p>
          )}
        </div>
      </section>
      <LobbyPlayersSidebar
        members={members}
        activeMemberCount={activeMemberCount}
        currentMemberId={currentMemberId}
        onlineByMemberId={onlineByMemberId}
        readyLabel="Ready to play"
        copied={copied}
        onInvite={onInvite}
        theme={PROMPT_ARCADE_LOBBY_SIDEBAR_THEME}
      />
    </main>
  );
}

type Standing = GameView['standings'][number];
type StandingMemberId = Standing['memberId'];

function reconcileStandingOrder(previousIds: StandingMemberId[], standingIds: StandingMemberId[]) {
  const currentIds = new Set(standingIds);
  const knownIds = new Set(previousIds);
  return [
    ...previousIds.filter((memberId) => currentIds.has(memberId)),
    ...standingIds.filter((id) => !knownIds.has(id)),
  ];
}

function useRoundStandingOrder(standings: GameView['standings'], roundNumber: number, phase: GameView['phase']) {
  const [frozenOrder, setFrozenOrder] = useState<{ roundNumber: number; memberIds: StandingMemberId[] }>(() => ({
    roundNumber,
    memberIds: standings.map((standing) => standing.memberId),
  }));
  const roundIsLive = phase === 'countdown' || phase === 'playing';
  const standingIdsKey = standings.map((standing) => standing.memberId).join('|');
  const standingIds = useMemo(
    () => (standingIdsKey === '' ? [] : (standingIdsKey.split('|') as StandingMemberId[])),
    [standingIdsKey]
  );
  const baseIds = frozenOrder.roundNumber === roundNumber ? frozenOrder.memberIds : standingIds;
  const nextIds = useMemo(() => reconcileStandingOrder(baseIds, standingIds), [baseIds, standingIds]);

  useEffect(() => {
    if (!roundIsLive) return;
    setFrozenOrder((previous) => {
      if (previous.roundNumber === roundNumber && previous.memberIds.join('|') === nextIds.join('|')) return previous;
      return { roundNumber, memberIds: nextIds };
    });
  }, [nextIds, roundIsLive, roundNumber]);

  if (!roundIsLive) return standings;
  const standingsById = new Map(standings.map((standing) => [standing.memberId, standing]));
  return nextIds.flatMap((memberId) => {
    const standing = standingsById.get(memberId);
    return standing === undefined ? [] : [standing];
  });
}

function RoundStandings({ game, copied, onInvite }: { game: GameView; copied: boolean; onInvite: () => void }) {
  const roundNumber = game.round?.roundNumber ?? game.currentRoundNumber;
  const roundIsLive = game.phase === 'countdown' || game.phase === 'playing';
  const resultByMemberId = useMemo(
    () => new Map(game.roundResults.map((result) => [result.memberId, result])),
    [game.roundResults]
  );
  const roundStartStandings = useMemo(() => {
    if (!roundIsLive) return game.standings;
    return [...game.standings].sort((first, second) => {
      const firstRoundScore = resultByMemberId.get(first.memberId)?.score ?? 0;
      const secondRoundScore = resultByMemberId.get(second.memberId)?.score ?? 0;
      return (
        second.totalScore - secondRoundScore - (first.totalScore - firstRoundScore) ||
        first.displayName.localeCompare(second.displayName)
      );
    });
  }, [game.standings, resultByMemberId, roundIsLive]);
  const orderedStandings = useRoundStandingOrder(roundStartStandings, roundNumber, game.phase);
  const currentPlayer = game.standings.find((standing) => standing.isCurrentPlayer) ?? null;
  const standingsOrderKey = orderedStandings.map((standing) => standing.memberId).join('|');
  const setStandingItemRef = useListReorderAnimation(standingsOrderKey, {
    animate: game.phase === 'roundResults',
    resetKey: roundNumber,
  });

  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-[16px_10px_18px_12px] border border-[#aaa8cf] bg-[#f8f7ff] shadow-[5px_6px_0_#d3dae6]',
        GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS,
        'max-[860px]:h-auto max-[860px]:max-h-96'
      )}
      aria-label="Prompt Arcade standings"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#d2d0e8] bg-white/65 px-4 py-4">
        <div>
          <p className="mb-0.5 text-[9px] font-[850] tracking-[0.13em] text-[#564dd8] uppercase">Live table</p>
          <h2 className="m-0 font-display text-xl font-[850] tracking-[-0.04em]">Standings</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e4e1ff] px-2 py-1.5 text-[10px] font-[800] text-[#5148c5]">
          <UsersRound className="size-3" aria-hidden="true" /> {orderedStandings.length}
        </span>
      </div>
      {currentPlayer !== null ? (
        <div className="mx-3 mt-3 rounded-[11px_7px_12px_8px] bg-[#17203a] px-3 py-2.5 text-white">
          <span className="text-[10px] font-[760] text-[#bfc8d8]">Your score</span>
          <strong className="float-right font-display text-lg text-[#ffd75a] tabular-nums">
            {formatPoints(currentPlayer.totalScore)}
          </strong>
        </div>
      ) : null}
      <ol
        className="m-0 grid min-h-0 flex-1 list-none content-start gap-1 overflow-y-auto p-3"
        aria-label="Player standings"
      >
        {orderedStandings.map((entry, index) => {
          const displayRank = roundIsLive ? index + 1 : entry.rank;
          const roundResult = resultByMemberId.get(entry.memberId);
          const hasRoundScore = roundResult !== undefined && roundResult.status !== 'waiting';
          return (
            <li
              ref={(element) => setStandingItemRef(entry.memberId, element)}
              className={cn(
                'grid min-h-13 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px_7px_11px_8px] px-2.5 py-2 text-[#536079] transition-[background-color,opacity] data-[current=true]:bg-[#e9e6ff] data-[reordering=true]:z-2 data-[reordering=true]:pointer-events-none motion-reduce:transition-none',
                !entry.isActive && 'opacity-45 grayscale'
              )}
              key={entry.memberId}
              data-current={entry.isCurrentPlayer}
              data-display-rank={displayRank}
              data-authoritative-rank={entry.rank}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#e5e8ef] text-[10px] font-[850] text-[#536079]">
                {displayRank <= 3 && !roundIsLive ? (
                  <Medal className="size-3.5 text-[#c49113]" aria-label={`Position ${displayRank}`} />
                ) : (
                  displayRank
                )}
              </span>
              <span className="grid min-w-0">
                <strong className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[#26334d]">
                  {entry.displayName} {entry.isCurrentPlayer ? '(you)' : ''}
                </strong>
                <small className="overflow-hidden text-[9px] text-ellipsis whitespace-nowrap text-[#8993a3]">
                  {!entry.isActive
                    ? 'Left the room'
                    : game.phase === 'complete' && entry.creatorBonus > 0
                      ? `Top-rated creator · +${formatPoints(entry.creatorBonus)} bonus`
                      : roundResult?.status === 'finished'
                        ? 'Finished this game'
                        : roundResult?.status === 'timedOut'
                          ? 'Time expired'
                          : `${entry.roundsFinished} ${entry.roundsFinished === 1 ? 'game' : 'games'} scored`}
                </small>
              </span>
              <span className="grid justify-items-end">
                <strong className="text-xs tabular-nums text-[#564dd8]">{formatPoints(entry.totalScore)}</strong>
                {hasRoundScore ? (
                  <small
                    className={cn(
                      'animate-in text-[9px] font-[850] tabular-nums fade-in slide-in-from-bottom-1 duration-300',
                      roundResult.score > 0 ? 'text-[#16856b]' : 'text-[#8993a3]'
                    )}
                  >
                    +{formatPoints(roundResult.score)}
                    <span className="sr-only"> points gained this round</span>
                  </small>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <Button
        className="m-3 mt-0 inline-flex h-10 w-[calc(100%-24px)] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#bbc6d6] bg-[#f8f9fc] px-3 text-xs font-[760] text-[#5148c5] enabled:hover:border-[#aaa8cf] enabled:hover:bg-[#f1efff] enabled:hover:text-[#5148c5] [&_svg]:size-4"
        type="button"
        onClick={onInvite}
        variant="paper"
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Link copied' : 'Invite more players'}
      </Button>
    </aside>
  );
}

function RoundHeader({ game, now }: { game: GameView; now: number }) {
  if (game.round === null) return null;
  const remaining = Math.max(0, (game.phaseEndsAt ?? game.round.playEndsAt) - now);
  return (
    <header className="flex items-start justify-between gap-4 border-b border-[#d3d9e4] bg-white px-5 py-4">
      <div>
        <p className="mb-1 text-[9px] font-[860] tracking-[0.14em] text-[#ef7543] uppercase">
          Cartridge {game.round.roundNumber} · by {game.round.entry.displayName}
        </p>
        <h1 className="m-0 font-display text-[clamp(26px,4vw,40px)] leading-[0.95] font-[890] tracking-[-0.055em]">
          {game.round.artifact.title}
        </h1>
      </div>
      {game.phase === 'countdown' || game.phase === 'playing' ? (
        <strong
          className="grid size-13 shrink-0 place-items-center rounded-full border-2 border-[#17203a] bg-[#ffd75a] font-display text-base font-[900] tabular-nums shadow-[3px_3px_0_#17203a]"
          role="timer"
          aria-label={`${game.phase === 'countdown' ? 'Game starts' : 'Time remaining'}: ${formatSeconds(remaining)}`}
        >
          {formatSeconds(remaining)}
        </strong>
      ) : null}
    </header>
  );
}

function CountdownSurface({ game, now }: { game: GameView; now: number }) {
  if (game.round === null) return null;
  const elapsedMs = Math.max(0, now - game.round.countdownStartedAt);
  const showGameDetails = elapsedMs >= AUTHOR_SPOTLIGHT_MS;
  const showStartCountdown = elapsedMs >= GAME_DETAILS_SPOTLIGHT_MS;
  const startSeconds = Math.max(1, Math.ceil((game.round.playStartsAt - now) / 1_000));
  return (
    <div
      className="relative min-h-[clamp(440px,calc(100dvh-150px),640px)] overflow-hidden bg-[#f8f7ff] px-6 text-center max-[520px]:px-4"
      data-reveal-stage={showStartCountdown ? 'countdown' : showGameDetails ? 'game' : 'author'}
    >
      <span
        className="pointer-events-none absolute -top-14 -right-10 size-52 rotate-12 rounded-[38%_62%_55%_45%] bg-[#e0dcff] opacity-80"
        aria-hidden="true"
      />
      <div
        className="relative z-1 mx-auto flex min-h-[clamp(440px,calc(100dvh-150px),640px)] w-full max-w-205 flex-col items-center justify-center py-8 max-[520px]:py-6"
        data-countdown-content
      >
        <div
          className="max-w-full shrink-0 transition-[font-size,line-height,margin,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          data-countdown-section="author"
        >
          <span
            className={cn(
              'mx-auto grid -rotate-3 place-items-center border-2 border-[#17203a] bg-[#cabfff] shadow-[5px_5px_0_#17203a] transition-[width,height,margin,border-radius] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              showGameDetails
                ? 'mb-3 size-12 rounded-[16px_10px_18px_12px]'
                : 'mb-5 size-18 rounded-[23px_14px_25px_16px]'
            )}
          >
            <Gamepad2
              className={cn(
                'text-[#5148c5] transition-[width,height] duration-700 motion-reduce:transition-none',
                showGameDetails ? 'size-5' : 'size-8'
              )}
              aria-hidden="true"
            />
          </span>
          <p className="mb-2 text-[10px] font-[850] tracking-[0.15em] text-[#564dd8] uppercase">This game is by</p>
          <h2
            className={cn(
              'm-0 max-w-full break-words font-display font-[920] tracking-[-0.07em] transition-[font-size,line-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              showGameDetails
                ? 'text-[clamp(32px,5vw,50px)] leading-[0.9]'
                : 'text-[clamp(46px,8vw,82px)] leading-[0.86]'
            )}
          >
            {game.round.entry.displayName}
          </h2>
        </div>

        <div
          className={cn(
            'grid w-full transition-[grid-template-rows,opacity,margin,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            showGameDetails
              ? 'mt-6 grid-rows-[1fr] translate-y-0 opacity-100'
              : 'mt-0 grid-rows-[0fr] translate-y-5 opacity-0'
          )}
          data-countdown-section="game"
          aria-hidden={!showGameDetails}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="mb-2 text-[9px] font-[850] tracking-[0.15em] text-[#ef7543] uppercase">
              Cartridge {game.round.roundNumber}
            </p>
            <h3 className="m-0 max-w-full break-words font-display text-[clamp(32px,6vw,58px)] leading-[0.92] font-[910] tracking-[-0.065em]">
              {game.round.artifact.title}
            </h3>
            <p className="mx-auto mt-4 mb-0 max-w-165 text-[clamp(13px,2vw,16px)] leading-[1.5] text-[#687389]">
              {game.round.artifact.instructions}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'grid w-full transition-[grid-template-rows,opacity,margin,transform] duration-500 motion-reduce:transition-none',
            showStartCountdown
              ? 'mt-7 grid-rows-[1fr] translate-y-0 opacity-100'
              : 'mt-0 grid-rows-[0fr] translate-y-4 opacity-0'
          )}
          data-countdown-section="timer"
          aria-hidden={!showStartCountdown}
        >
          <p
            className="m-0 min-h-0 overflow-hidden font-display text-3xl font-[920] text-[#ef7543] tabular-nums"
            aria-live="polite"
          >
            Starts in {startSeconds}
          </p>
        </div>
      </div>
    </div>
  );
}

function WaitingForCartridge({
  game,
  finishingStalled,
  onRequestFinishStalled,
  copied,
  onInvite,
}: {
  game: GameView;
  finishingStalled: boolean;
  onRequestFinishStalled: () => void;
  copied: boolean;
  onInvite: () => void;
}) {
  const unfinishedCount = game.summary.writing + game.summary.needsRevision;
  const availableOrBuildingCount =
    game.summary.ready +
    game.summary.queued +
    game.summary.generating +
    game.summary.validating +
    game.summary.repairing;
  const canFinishStalled =
    game.isOwner &&
    game.playlistStarted &&
    game.round === null &&
    unfinishedCount > 0 &&
    availableOrBuildingCount === 0;
  const stalled = game.playlistStarted && game.round === null && unfinishedCount > 0 && availableOrBuildingCount === 0;
  const readyGameWaiting = game.summary.ready > 0;
  return (
    <main className={cn(GAME_LOBBY_FRAME_CLASS, GAME_LOBBY_GRID_CLASS)}>
      <section className="grid min-h-85 place-content-center rounded-[22px_14px_24px_16px] border border-[#bdc7d6] bg-[#f8f9ff] px-6 text-center shadow-[6px_7px_0_#d4dbe6]">
        {stalled ? (
          <Check className="mx-auto mb-4 size-9 text-[#21816d]" aria-hidden="true" />
        ) : (
          <LoaderCircle
            className="mx-auto mb-4 size-8 animate-spin text-[#564dd8] motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        <h1 className="m-0 font-display text-[clamp(30px,5vw,48px)] font-[890] tracking-[-0.055em]">
          {stalled
            ? 'All playable games are done.'
            : readyGameWaiting
              ? 'Loading the next cartridge.'
              : 'The next cartridge is still building.'}
        </h1>
        <p className="mx-auto mt-3 mb-0 max-w-135 text-sm leading-[1.5] text-[#687389]">
          {stalled
            ? `${unfinishedCount} unfinished ${unfinishedCount === 1 ? 'prompt has' : 'prompts have'} no playable game. ${game.isOwner ? 'Finish the playlist to mark them withdrawn and continue to the final scores.' : 'The room owner can mark them withdrawn and continue to the final scores.'}`
            : readyGameWaiting
              ? 'A finished game is ready. The server is preparing it for the room.'
              : 'Nothing was dropped. The playlist will continue as soon as another player’s game passes its checks.'}
        </p>
        {canFinishStalled ? (
          <Button
            className="mx-auto mt-6"
            variant="destructive-soft"
            type="button"
            onClick={onRequestFinishStalled}
            disabled={finishingStalled}
          >
            {finishingStalled ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            Finish without unfinished prompts
          </Button>
        ) : null}
      </section>
      <FactoryPlayersSidebar game={game} copied={copied} startingPlaylist={false} onInvite={onInvite} />
    </main>
  );
}

type RoundResult = GameView['roundResults'][number];

type RoundRecapEntry = {
  result: RoundResult;
  standing: Standing;
  previousRank: number;
  rankChange: number;
};

function buildRoundRecap(game: GameView): RoundRecapEntry[] {
  const scoreByMemberId = new Map(game.roundResults.map((result) => [result.memberId, result.score]));
  const previousRankByMemberId = new Map(
    game.standings
      .map((standing) => ({
        memberId: standing.memberId,
        displayName: standing.displayName,
        totalScore: standing.totalScore - (scoreByMemberId.get(standing.memberId) ?? 0),
      }))
      .sort(
        (first, second) => second.totalScore - first.totalScore || first.displayName.localeCompare(second.displayName)
      )
      .map((standing, index) => [standing.memberId, index + 1] as const)
  );
  const standingByMemberId = new Map(game.standings.map((standing) => [standing.memberId, standing]));

  return game.roundResults
    .filter((result) => result.status !== 'waiting')
    .flatMap((result) => {
      const standing = standingByMemberId.get(result.memberId);
      if (standing === undefined) return [];
      const previousRank = previousRankByMemberId.get(result.memberId) ?? standing.rank;
      return [{ result, standing, previousRank, rankChange: previousRank - standing.rank }];
    });
}

function RankMovement({ entry }: { entry: RoundRecapEntry }) {
  if (entry.rankChange > 0) {
    return (
      <>
        <span className="inline-flex items-center gap-1 font-[820] text-[#16856b]" aria-hidden="true">
          <span>#{entry.previousRank}</span>
          <ArrowUp className="size-3" />
          <span>#{entry.standing.rank}</span>
        </span>
        <span className="sr-only">
          Moved from position {entry.previousRank} to {entry.standing.rank}
        </span>
      </>
    );
  }
  if (entry.rankChange < 0) {
    return (
      <>
        <span className="inline-flex items-center gap-1 font-[820] text-[#c25b3e]" aria-hidden="true">
          <span>#{entry.previousRank}</span>
          <ArrowDown className="size-3" />
          <span>#{entry.standing.rank}</span>
        </span>
        <span className="sr-only">
          Moved from position {entry.previousRank} to {entry.standing.rank}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="font-[760] text-[#7a8597]" aria-hidden="true">
        Held #{entry.standing.rank}
      </span>
      <span className="sr-only">Held position {entry.standing.rank}</span>
    </>
  );
}

function RoundResults({
  game,
  now,
  playIntro,
  onRateGame,
}: {
  game: GameView;
  now: number;
  playIntro: boolean;
  onRateGame: (rating: number) => Promise<void>;
}) {
  if (game.round === null) return null;
  const recap = buildRoundRecap(game);
  const podium = recap.slice(0, 3);
  const toughestRound = recap.length > 3 ? recap.at(-1) : undefined;
  return (
    <div className="min-h-[clamp(440px,calc(100dvh-220px),640px)] bg-[#f8f9ff] p-5 max-[520px]:p-3">
      <div className="mx-auto max-w-205">
        <PromptArcadeRatingPanel
          title={game.round.artifact.title}
          phaseEndsAt={game.phaseEndsAt}
          now={now}
          rating={game.currentGameRating.rating}
          canRate={game.currentGameRating.canRate}
          isAuthor={game.round.entry.memberId === game.entries.find((entry) => entry.isCurrentPlayer)?.memberId}
          isParticipant={game.currentResult !== null}
          ratingCount={game.currentGameRating.ratingCount}
          eligibleRaterCount={game.currentGameRating.eligibleRaterCount}
          onRate={onRateGame}
        />
        <div
          className={cn(
            'mb-5 rounded-[14px_9px_15px_10px] border border-[#bfc9d8] bg-white px-4 py-3 text-sm leading-[1.45] text-[#58657b] shadow-[0_3px_0_#d4dbe6]',
            playIntro &&
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500'
          )}
        >
          <strong className="text-[#17203a]">What the builder made:</strong> {game.round.artifact.interpretation}
        </div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[9px] font-[850] tracking-[0.14em] text-[#564dd8] uppercase">Round podium</p>
            <h2 className="m-0 font-display text-[clamp(26px,4vw,38px)] leading-none font-[890] tracking-[-0.05em]">
              Top scorers this game
            </h2>
          </div>
          <Trophy className="size-7 shrink-0 text-[#d0a018]" aria-hidden="true" />
        </div>
        <ol
          className="m-0 grid list-none grid-cols-3 gap-2 p-0 max-[620px]:grid-cols-1"
          aria-label="Top scorers this round"
        >
          {podium.map((entry, index) => (
            <li
              className={cn(
                'relative grid min-h-31 content-between overflow-hidden rounded-[15px_9px_16px_10px] border border-[#c3ccda] bg-white p-3 shadow-[0_3px_0_#d7deea]',
                index === 0 && 'border-[#d0a018] bg-[#fff8d7]',
                entry.result.isCurrentPlayer && 'ring-2 ring-[#665edb]/35',
                playIntro &&
                  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-500'
              )}
              key={entry.result.memberId}
              style={playIntro ? { animationDelay: `${140 + index * 110}ms` } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-[#17203a] text-[10px] font-[850] text-white">
                  {index + 1}
                </span>
                <strong className="font-display text-xl font-[900] text-[#564dd8] tabular-nums">
                  +{formatPoints(entry.result.score)}
                </strong>
              </div>
              <div className="mt-3 min-w-0">
                <strong className="block overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[#17203a]">
                  {entry.result.displayName}
                </strong>
                <small className="mt-1 block text-[10px] text-[#748095]">
                  <RankMovement entry={entry} /> overall
                </small>
              </div>
            </li>
          ))}
        </ol>
        {toughestRound !== undefined ? (
          <div
            className={cn(
              'mt-4 flex items-center justify-between gap-4 rounded-[13px_8px_14px_9px] border border-[#e0b09f] bg-[#fff1eb] px-4 py-3 text-sm shadow-[0_3px_0_#ead1c7]',
              playIntro &&
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500 motion-safe:delay-500'
            )}
          >
            <div className="min-w-0">
              <p className="mb-0.5 text-[9px] font-[850] tracking-[0.12em] text-[#b44f34] uppercase">Tough break</p>
              <strong className="block truncate text-[#4f352e]">{toughestRound.result.displayName}</strong>
            </div>
            <div className="shrink-0 text-right">
              <strong className="block text-[#b44f34] tabular-nums">+{formatPoints(toughestRound.result.score)}</strong>
              <small className="text-[10px]">
                <RankMovement entry={toughestRound} /> overall
              </small>
            </div>
          </div>
        ) : null}
        <p className="mt-4 mb-0 text-center text-xs font-[720] text-[#748095]">
          Standings lock in, then the next creator gets the spotlight.
        </p>
      </div>
    </div>
  );
}

function ActiveRoundSurface({
  game,
  now,
  onFinish,
  onRateGame,
  resultPending,
  failedFinish,
  onRetryFinish,
  finishingStalled,
  onRequestFinishStalled,
  onRuntimeError,
  copied,
  onInvite,
}: {
  game: GameView;
  now: number;
  onFinish: (result: GeneratedGameFinish) => void;
  onRateGame: (rating: number) => Promise<void>;
  resultPending: boolean;
  failedFinish: FailedFinish | null;
  onRetryFinish: () => void;
  finishingStalled: boolean;
  onRequestFinishStalled: () => void;
  onRuntimeError: (message: string) => void;
  copied: boolean;
  onInvite: () => void;
}) {
  if (game.round === null) {
    return (
      <WaitingForCartridge
        game={game}
        finishingStalled={finishingStalled}
        onRequestFinishStalled={onRequestFinishStalled}
        copied={copied}
        onInvite={onInvite}
      />
    );
  }
  let content: ReactNode;
  let surfaceKey: string;
  if (game.phase === 'countdown') {
    content = <CountdownSurface game={game} now={now} />;
    surfaceKey = `${game.round.roundId}:countdown`;
  } else if (game.currentResult === null) {
    content = (
      <div
        className="grid min-h-[clamp(440px,calc(100dvh-220px),640px)] place-content-center bg-[#f4f3ff] px-6 text-center"
        role="status"
      >
        <Gamepad2 className="mx-auto mb-4 size-9 text-[#564dd8]" aria-hidden="true" />
        <h2 className="m-0 font-display text-[clamp(34px,6vw,56px)] font-[900] tracking-[-0.06em]">Spectator mode.</h2>
        <p className="mx-auto mt-3 mb-0 max-w-120 text-sm leading-[1.5] text-[#687389]">
          This playlist was already locked when you joined. Watch the room play, then join the next game.
        </p>
      </div>
    );
    surfaceKey = `${game.round.roundId}:spectating`;
  } else if (game.currentResult?.status === 'finished') {
    content = (
      <div
        className="grid min-h-[clamp(440px,calc(100dvh-220px),640px)] place-content-center bg-[#f0fbf7] px-6 text-center"
        role="status"
      >
        <span className="mx-auto mb-4 grid size-15 place-items-center rounded-full border-2 border-[#17203a] bg-[#8be1d2] shadow-[4px_4px_0_#17203a]">
          <Check className="size-6" aria-hidden="true" />
        </span>
        <h2 className="m-0 font-display text-[clamp(34px,6vw,58px)] font-[900] tracking-[-0.06em]">Score recorded.</h2>
        <p className="mt-3 mb-0 text-sm text-[#607369]">
          You earned {formatPoints(game.currentResult.score)} points. Waiting for the room…
        </p>
      </div>
    );
    surfaceKey = `${game.round.roundId}:finished`;
  } else if (game.currentResult?.status === 'timedOut') {
    content = (
      <div
        className="grid min-h-[clamp(440px,calc(100dvh-220px),640px)] place-content-center bg-[#fff9ea] px-6 text-center"
        role="status"
      >
        <Clock3 className="mx-auto mb-4 size-9 text-[#ef7543]" aria-hidden="true" />
        <h2 className="m-0 font-display text-4xl font-[890] tracking-[-0.05em]">Time&apos;s up.</h2>
        <p className="mt-3 mb-0 text-sm text-[#746d5b]">Waiting for the round results.</p>
      </div>
    );
    surfaceKey = `${game.round.roundId}:timed-out`;
  } else if (failedFinish !== null && failedFinish.roundId === game.round.roundId) {
    content = (
      <div
        className="grid min-h-[clamp(440px,calc(100dvh-220px),640px)] place-content-center bg-[#fff5ef] px-6 text-center"
        role="alert"
      >
        <AlertTriangle className="mx-auto mb-4 size-9 text-[#c6573c]" aria-hidden="true" />
        <h2 className="m-0 font-display text-[clamp(30px,5vw,48px)] font-[890] tracking-[-0.055em]">
          Your finish is waiting to send.
        </h2>
        <p className="mx-auto mt-3 mb-5 max-w-125 text-sm leading-[1.5] text-[#765e56]">
          The game is complete on this device. Retry the same result before the round closes.
        </p>
        <Button className="mx-auto" type="button" onClick={onRetryFinish} disabled={resultPending}>
          {resultPending ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          Retry score submission
        </Button>
      </div>
    );
    surfaceKey = `${game.round.roundId}:finish-failed`;
  } else if (resultPending) {
    content = (
      <div
        className="grid min-h-[clamp(440px,calc(100dvh-220px),640px)] place-content-center bg-[#f0fbf7] px-6 text-center"
        role="status"
      >
        <LoaderCircle
          className="mx-auto mb-4 size-8 animate-spin text-[#21816d] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <h2 className="m-0 font-display text-3xl font-[880] tracking-[-0.05em]">Recording your finish…</h2>
      </div>
    );
    surfaceKey = `${game.round.roundId}:finish-pending`;
  } else if (game.round.artifact.codeUrl === null) {
    content = (
      <div className="grid min-h-100 place-content-center bg-[#fff2ed] px-6 text-center" role="alert">
        <AlertTriangle className="mx-auto mb-3 size-8 text-[#b54c35]" aria-hidden="true" />
        <h2 className="m-0 font-display text-2xl font-[860]">The game file is unavailable.</h2>
        <p className="mt-2 mb-0 text-sm text-[#7d5d53]">The server will close this round and move on.</p>
      </div>
    );
    surfaceKey = `${game.round.roundId}:unavailable`;
  } else {
    content = (
      <GeneratedGameFrame
        key={game.round.roundId}
        title={game.round.artifact.title}
        codeUrl={game.round.artifact.codeUrl}
        playEndsAt={game.round.playEndsAt}
        onFinish={onFinish}
        onRuntimeError={onRuntimeError}
      />
    );
    surfaceKey = `${game.round.roundId}:playing`;
  }

  return (
    <main
      className={cn(
        GAME_LOBBY_FRAME_CLASS,
        'grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4.5 max-[860px]:grid-cols-1'
      )}
    >
      <section className="overflow-hidden rounded-[20px_13px_22px_15px] border-2 border-[#17203a] bg-white shadow-[7px_7px_0_#17203a]">
        <GameSurfaceTransition
          showResults={game.phase === 'roundResults'}
          surfaceKey={surfaceKey}
          results={({ playIntro }) => (
            <>
              <RoundHeader game={game} now={now} />
              <RoundResults game={game} now={now} playIntro={playIntro} onRateGame={onRateGame} />
            </>
          )}
        >
          {game.phase === 'countdown' ? null : <RoundHeader game={game} now={now} />}
          {content}
        </GameSurfaceTransition>
      </section>
      <RoundStandings game={game} copied={copied} onInvite={onInvite} />
    </main>
  );
}

function CompleteSurface({
  game,
  guest,
  session,
  isClosed,
  copied,
  onInvite,
}: {
  game: GameView;
  guest: GuestIdentity;
  session: ActiveSession;
  isClosed: boolean;
  copied: boolean;
  onInvite: () => void;
}) {
  const [showPlayerScores, setShowPlayerScores] = useState(game.gameRankings.length === 0);
  const showScores = useCallback(() => setShowPlayerScores(true), []);
  const podiumEntries = game.standings.slice(0, 3).map((entry) => ({
    id: entry.memberId,
    place: entry.rank,
    name: entry.displayName,
    result: `${formatPoints(entry.totalScore)} points`,
  }));
  return (
    <main className={GAME_LOBBY_FRAME_CLASS}>
      <GameSurfaceTransition
        showResults={showPlayerScores}
        results={({ playIntro }) => (
          <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4.5 max-[860px]:grid-cols-1">
            <section className="min-w-0">
              <PostGameBoard
                eyebrow="Factory closed · Final player scores"
                title={
                  game.standings[0] === undefined
                    ? 'Arcade complete.'
                    : `${game.standings[0].displayName} wins the arcade.`
                }
                detail={`${game.summary.played} player-made ${game.summary.played === 1 ? 'game' : 'games'} made it through the playlist. Creator bonuses are included.`}
                icon={Trophy}
                accent="#564dd8"
                accentTint="#e8e4ff"
                roomId={session.roomId}
                currentGameId={session.currentGameId}
                currentGameType={session.gameType}
                sessionToken={guest.sessionToken}
                isOwner={game.isOwner}
                isClosed={isClosed}
                closedMessage="Room closed. The final Prompt Arcade scores stay visible."
                summary={<PostGamePodium entries={podiumEntries} label="Prompt Arcade player podium" />}
                playIntro={playIntro}
              />
            </section>
            <RoundStandings game={game} copied={copied} onInvite={onInvite} />
          </div>
        )}
      >
        <PromptArcadeGameShowcase rankings={game.gameRankings} onFinished={showScores} />
      </GameSurfaceTransition>
    </main>
  );
}

export default function PromptArcadeRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.promptArcade.getGame, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const startGame = useMutation(api.promptArcade.startGame);
  const submitPrompt = useAction(api.promptArcadeActions.submitPrompt);
  const retryGeneration = useAction(api.promptArcadeActions.retryGeneration);
  const startPlaylist = useMutation(api.promptArcade.startPlaylist);
  const finishStalledPlaylist = useMutation(api.promptArcade.finishStalledPlaylist);
  const submitResult = useMutation(api.promptArcade.submitResult);
  const submitRating = useMutation(api.promptArcade.submitRating);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [starting, setStarting] = useState(false);
  const [startingPlaylist, setStartingPlaylist] = useState(false);
  const [finishingStalled, setFinishingStalled] = useState(false);
  const [resultPending, setResultPending] = useState(false);
  const [failedFinish, setFailedFinish] = useState<FailedFinish | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | 'finishStalled' | null>(null);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const [closeSucceeded, setCloseSucceeded] = useState(false);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const isClosed = session.status === 'closed' || closeSucceeded;
  const timerEnabled = game?.phase === 'countdown' || game?.phase === 'playing' || game?.phase === 'roundResults';
  const now = useClock(timerEnabled);
  const members = useMemo(() => getRoomMembers(session), [session]);
  const roundPhaseKey = game?.round?.roundId;

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (game?.phase !== 'lobby') setStarting(false);
    if (game?.playlistStarted) setStartingPlaylist(false);
  }, [game?.phase, game?.playlistStarted]);

  useEffect(() => {
    void roundPhaseKey;
    setResultPending(false);
    setFailedFinish(null);
  }, [roundPhaseKey]);

  useEffect(() => {
    if (game?.currentResult?.status === 'finished' || game?.currentResult?.status === 'timedOut') {
      setResultPending(false);
      setFailedFinish(null);
    }
  }, [game?.currentResult?.status]);

  useEffect(() => {
    const codeUrl = game?.phase === 'countdown' ? game.round?.artifact.codeUrl : null;
    if (codeUrl !== null && codeUrl !== undefined) prefetchGeneratedGame(codeUrl);
  }, [game?.phase, game?.round?.artifact.codeUrl]);

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setNotice(null);
    } catch {
      setNotice('Copy failed. Select the browser address to share this room.');
    }
  }

  async function handleStart() {
    setStarting(true);
    setNotice(null);
    try {
      await startGame({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (startError) {
      setNotice(userFacingError(startError, 'The game factory could not be opened.'));
      setStarting(false);
    }
  }

  async function handleSubmitPrompt(prompt: string) {
    setNotice(null);
    await submitPrompt({ roomId: session.roomId, sessionToken: guest.sessionToken, prompt });
  }

  async function handleStartPlaylist() {
    setStartingPlaylist(true);
    setNotice(null);
    try {
      await startPlaylist({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (playlistError) {
      setNotice(userFacingError(playlistError, 'The playlist could not be started.'));
      setStartingPlaylist(false);
    }
  }

  async function handleRetryGeneration() {
    setNotice(null);
    await retryGeneration({ roomId: session.roomId, sessionToken: guest.sessionToken });
  }

  async function handleFinishStalledPlaylist() {
    setConfirmation(null);
    setFinishingStalled(true);
    setNotice(null);
    try {
      await finishStalledPlaylist({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (finishError) {
      setNotice(userFacingError(finishError, 'The unfinished prompts could not be withdrawn.'));
      setFinishingStalled(false);
    }
  }

  const sendFinish = useCallback(
    async (finish: FailedFinish) => {
      if (resultPending) return;
      setResultPending(true);
      setFailedFinish(null);
      setNotice(null);
      try {
        await submitResult({
          roomId: session.roomId,
          sessionToken: guest.sessionToken,
          roundId: finish.roundId,
          quality: finish.result.quality,
          ...(finish.result.metricLabel === undefined ? {} : { metricLabel: finish.result.metricLabel }),
          ...(finish.result.metricValue === undefined ? {} : { metricValue: finish.result.metricValue }),
        });
      } catch (resultError) {
        setNotice(
          userFacingError(resultError, 'Your score could not be recorded. The server will still close the round.')
        );
        setFailedFinish(finish);
        setResultPending(false);
      }
    },
    [guest.sessionToken, resultPending, session.roomId, submitResult]
  );

  const handleFinish = useCallback(
    (result: GeneratedGameFinish) => {
      const roundId = game?.round?.roundId;
      if (roundId !== undefined) void sendFinish({ roundId, result });
    },
    [game?.round?.roundId, sendFinish]
  );

  const handleRetryFinish = useCallback(() => {
    if (failedFinish !== null) void sendFinish(failedFinish);
  }, [failedFinish, sendFinish]);

  const handleRateGame = useCallback(
    async (rating: number) => {
      const roundId = game?.round?.roundId;
      if (roundId === undefined) throw new Error('The Prompt Arcade rating round is no longer available.');
      setNotice(null);
      try {
        await submitRating({
          roomId: session.roomId,
          sessionToken: guest.sessionToken,
          roundId,
          rating,
        });
      } catch (ratingError) {
        setNotice(userFacingError(ratingError, 'Your game rating could not be recorded.'));
        throw ratingError;
      }
    },
    [game?.round?.roundId, guest.sessionToken, session.roomId, submitRating]
  );

  const handleRuntimeError = useCallback((message: string) => {
    setNotice(`This generated game stopped: ${message}`);
  }, []);

  async function handleLeave() {
    setConfirmation(null);
    setActionPending('leave');
    try {
      await leaveRoom({ code: session.code, sessionToken: guest.sessionToken });
      navigate('/');
    } catch (leaveError) {
      setNotice(userFacingError(leaveError, 'The room could not be left.'));
      setActionPending(null);
    }
  }

  async function handleClose() {
    setConfirmation(null);
    setActionPending('close');
    try {
      await closeRoom({ code: session.code, sessionToken: guest.sessionToken });
      setCloseSucceeded(true);
      setNotice(null);
      setActionPending(null);
    } catch (closeError) {
      setNotice(userFacingError(closeError, 'The room could not be closed.'));
      setActionPending(null);
    }
  }

  if (game === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center bg-[#f3f1eb] text-center text-[#69758b]">
        <WandSparkles className="mx-auto mb-4 size-12 text-[#564dd8]" aria-hidden="true" />
        <LoaderCircle className="mx-auto size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <p className="text-xs font-[750]">Opening the game factory…</p>
      </main>
    );
  }

  const surface =
    game.phase === 'lobby' ? (
      <LobbySurface
        game={game}
        members={members}
        activeMemberCount={session.activeMemberCount}
        currentMemberId={session.currentMember.memberId}
        onlineByMemberId={onlineByMemberId}
        copied={copied}
        starting={starting}
        onStart={handleStart}
        onInvite={copyRoomLink}
      />
    ) : game.phase === 'prompting' || (game.phase === 'generating' && !game.playlistStarted) ? (
      <FactorySurface
        game={game}
        onSubmitPrompt={handleSubmitPrompt}
        onRetryGeneration={handleRetryGeneration}
        onStartPlaylist={handleStartPlaylist}
        copied={copied}
        onInvite={copyRoomLink}
        startingPlaylist={startingPlaylist}
      />
    ) : game.phase === 'complete' ? (
      <CompleteSurface
        game={game}
        guest={guest}
        session={session}
        isClosed={isClosed}
        copied={copied}
        onInvite={copyRoomLink}
      />
    ) : game.phase === 'generating' && game.round === null ? (
      <WaitingForCartridge
        game={game}
        finishingStalled={finishingStalled}
        onRequestFinishStalled={() => setConfirmation('finishStalled')}
        copied={copied}
        onInvite={copyRoomLink}
      />
    ) : (
      <ActiveRoundSurface
        game={game}
        now={now}
        onFinish={handleFinish}
        onRateGame={handleRateGame}
        resultPending={resultPending}
        failedFinish={failedFinish}
        onRetryFinish={handleRetryFinish}
        finishingStalled={finishingStalled}
        onRequestFinishStalled={() => setConfirmation('finishStalled')}
        onRuntimeError={handleRuntimeError}
        copied={copied}
        onInvite={copyRoomLink}
      />
    );

  return (
    <div className="min-h-dvh bg-[#f3f1eb] bg-[linear-gradient(rgb(23_32_58/4%)_1px,transparent_1px),linear-gradient(90deg,rgb(23_32_58/4%)_1px,transparent_1px)] bg-size-[28px_28px] text-[#17203a]">
      <header className="sticky top-0 z-20 grid h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#c9c6bf] bg-[rgb(255_253_247/94%)] px-5 backdrop-blur-[14px] max-[760px]:h-16 max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2 font-display text-lg font-[900] tracking-[-0.04em] text-[#17203a] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span className="grid size-8 -rotate-3 place-items-center rounded-[10px_6px_11px_7px] border border-[#17203a] bg-[#ffd75a] shadow-[2px_2px_0_#17203a]">
            <WandSparkles className="size-4 text-[#564dd8]" aria-hidden="true" />
          </span>
          <span className="max-[460px]:hidden">Prompt Arcade</span>
        </Link>
        <button
          className="mx-auto inline-flex min-w-0 items-center gap-2 rounded-full border border-[#c7ceda] bg-white px-3 py-2 text-xs font-[760] text-[#58657b] shadow-[0_2px_0_#d7dce5] outline-none focus-visible:ring-3 focus-visible:ring-[#564dd8]/25"
          type="button"
          onClick={copyRoomLink}
          aria-label={copied ? 'Room link copied' : 'Copy room link'}
        >
          {copied ? (
            <Check className="size-3.5 text-[#21816d]" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5 text-[#564dd8]" aria-hidden="true" />
          )}
          <span className="max-[380px]:hidden">Room</span>{' '}
          <strong className="tracking-[0.1em] text-[#17203a]">{session.code}</strong>
        </button>
        <div className="flex items-center justify-end gap-2">
          <GameModeControl
            roomId={session.roomId}
            currentGameId={session.currentGameId}
            currentGameType={session.gameType}
            sessionToken={guest.sessionToken}
            isOwner={game.isOwner}
            isClosed={isClosed}
            onOpen={() => setGameModeOpen(true)}
          />
          <RoomHeaderActions
            isOwner={game.isOwner}
            isClosed={isClosed}
            pendingAction={actionPending}
            onRequestLeave={() => setConfirmation('leave')}
            onRequestClose={() => setConfirmation('close')}
          />
        </div>
      </header>

      {isClosed ? (
        <div
          className="sticky top-18 z-10 mx-auto flex min-h-11 w-full items-center justify-center gap-2 border-b border-[#cbc6e8] bg-[#eeebff]/96 px-4 py-2.5 text-center text-xs font-[720] text-[#5148c5] shadow-[0_4px_12px_rgb(23_32_58/8%)] backdrop-blur-[14px] max-[760px]:top-16"
          role="status"
          aria-label="Final score"
        >
          <Trophy className="size-4 shrink-0" aria-hidden="true" />
          <strong>Final score</strong>
          <span aria-hidden="true">·</span>
          <span>
            {game.standings[0] === undefined
              ? 'No games were scored.'
              : `${game.standings[0].displayName} · ${formatPoints(game.standings[0].totalScore)} points`}
          </span>
        </div>
      ) : null}

      {notice !== null ? (
        <div
          className="mx-auto mt-3 flex w-[calc(100%-24px)] max-w-345 items-start gap-2 rounded-[11px_7px_12px_8px] border border-[#e29a83] bg-[#fff2ec] px-3.5 py-3 text-xs leading-[1.45] font-[680] text-[#93432f]"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {notice}
        </div>
      ) : null}

      <GameModeContent
        roomId={session.roomId}
        currentGameId={session.currentGameId}
        currentGameType={session.gameType}
        sessionToken={guest.sessionToken}
        isOwner={game.isOwner}
        isClosed={isClosed}
        open={gameModeOpen}
        onClose={() => setGameModeOpen(false)}
      >
        {surface}
      </GameModeContent>

      <AlertDialog open={confirmation !== null} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmation === 'close'
              ? 'Close this room?'
              : confirmation === 'finishStalled'
                ? 'Finish this playlist?'
                : 'Leave this room?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation === 'close'
              ? 'This ends Prompt Arcade for everyone. The final scores will stay on screen.'
              : confirmation === 'finishStalled'
                ? 'All playable games are done. The remaining unfinished prompts will be marked withdrawn so the room can continue to final scores.'
                : 'You will leave the current game and return to the home screen.'}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                confirmation === 'close'
                  ? handleClose
                  : confirmation === 'finishStalled'
                    ? handleFinishStalledPlaylist
                    : handleLeave
              }
            >
              {confirmation === 'close'
                ? 'Close room'
                : confirmation === 'finishStalled'
                  ? 'Withdraw and finish'
                  : 'Leave room'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
