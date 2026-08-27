import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  AlertTriangle,
  Check,
  CircleDot,
  Clock3,
  Copy,
  DoorOpen,
  Gamepad2,
  Gauge,
  LoaderCircle,
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
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import GeneratedGameFrame, { type GeneratedGameFinish, prefetchGeneratedGame } from './GeneratedGameFrame';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type GameView = FunctionReturnType<typeof api.promptArcade.getGame>;
type PromptEntry = GameView['entries'][number];
type EntryStatus = PromptEntry['status'];
type RoundId = NonNullable<GameView['round']>['roundId'];
type FailedFinish = { roundId: RoundId; result: GeneratedGameFinish };

const PROMPT_MAX_LENGTH = 1_000;
const BUILD_STEPS = 4;
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
  { label: string; shortLabel: string; step: number; tone: string; icon: typeof CircleDot }
> = {
  writing: {
    label: 'Writing a prompt',
    shortLabel: 'Writing',
    step: 0,
    tone: 'border-[#bdc7d8] bg-[#f7f9fc] text-[#68758b]',
    icon: CircleDot,
  },
  queued: {
    label: 'Waiting for a builder',
    shortLabel: 'Queued',
    step: 1,
    tone: 'border-[#d2b844] bg-[#fff7c9] text-[#79650d]',
    icon: Clock3,
  },
  generating: {
    label: 'Building the game',
    shortLabel: 'Building',
    step: 2,
    tone: 'border-[#6e67da] bg-[#eeebff] text-[#5148c5]',
    icon: WandSparkles,
  },
  validating: {
    label: 'Checking the game',
    shortLabel: 'Checking',
    step: 3,
    tone: 'border-[#31a59b] bg-[#e3f8f4] text-[#197f77]',
    icon: Gauge,
  },
  repairing: {
    label: 'Repairing the game',
    shortLabel: 'Repairing',
    step: 3,
    tone: 'border-[#e18449] bg-[#fff0df] text-[#a84f25]',
    icon: Wrench,
  },
  ready: {
    label: 'Ready to play',
    shortLabel: 'Ready',
    step: 4,
    tone: 'border-[#249780] bg-[#dff7ed] text-[#15705f]',
    icon: Check,
  },
  needsRevision: {
    label: 'Needs a new prompt',
    shortLabel: 'Revise',
    step: 0,
    tone: 'border-[#d26c55] bg-[#fff0ea] text-[#a34430]',
    icon: AlertTriangle,
  },
  withdrawn: {
    label: 'Player left before building',
    shortLabel: 'Withdrawn',
    step: 0,
    tone: 'border-[#c4cad4] bg-[#eef0f4] text-[#70798a]',
    icon: DoorOpen,
  },
  played: {
    label: 'Played',
    shortLabel: 'Played',
    step: 4,
    tone: 'border-[#4d60a8] bg-[#e9edff] text-[#3c4d92]',
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
      <div
        className="flex h-7 shrink-0 items-center gap-1.5 border-b border-[#26324a] bg-[#37435b] px-3"
        role="progressbar"
        aria-label={`${readyCount} of ${game.summary.total} player-made games are ready`}
        aria-valuemin={0}
        aria-valuemax={game.summary.total}
        aria-valuenow={readyCount}
      >
        {game.entries.map((entry) => (
          <span
            className={cn(
              'h-2.5 min-w-1 flex-1 rounded-full border border-[#657189] bg-[#778298]',
              entry.status === 'queued' && 'border-[#dec653] bg-[#f3d95f]',
              entry.status === 'generating' && 'border-[#8d85ec] bg-[#9d96ee] motion-safe:animate-pulse',
              (entry.status === 'validating' || entry.status === 'repairing') && 'border-[#64c9bc] bg-[#79d7ca]',
              (entry.status === 'ready' || entry.status === 'played') && 'border-[#51c5a8] bg-[#65d6b8]',
              entry.status === 'needsRevision' && 'border-[#eb927c] bg-[#f39a83]'
            )}
            key={entry.entryId}
            title={`${entry.displayName}: ${STATUS_PRESENTATION[entry.status].label}`}
            aria-hidden="true"
          />
        ))}
      </div>
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

function RoundStandings({
  standings,
  copied,
  onInvite,
}: {
  standings: GameView['standings'];
  copied: boolean;
  onInvite: () => void;
}) {
  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-[16px_10px_18px_12px] border border-[#bbc6d6] bg-white shadow-[5px_6px_0_#d3dae6]',
        GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS,
        'max-[860px]:h-auto max-[860px]:max-h-80'
      )}
      aria-label="Prompt Arcade standings"
    >
      <div className="border-b border-[#d2d9e4] px-4 py-4">
        <p className="mb-0.5 text-[9px] font-[850] tracking-[0.13em] text-[#564dd8] uppercase">All cartridges</p>
        <h2 className="m-0 font-display text-xl font-[850] tracking-[-0.04em]">Standings</h2>
      </div>
      <ol className="m-0 grid min-h-0 flex-1 list-none content-start gap-1 overflow-y-auto p-3">
        {standings.map((entry) => (
          <li
            className={cn(
              'grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px_7px_11px_8px] px-2.5 py-2.5',
              entry.isCurrentPlayer && 'bg-[#efedff]',
              !entry.isActive && 'opacity-50'
            )}
            key={entry.memberId}
          >
            <span className="grid size-7 place-items-center rounded-full bg-[#e8ecf3] text-[10px] font-[850] text-[#536079]">
              {entry.rank}
            </span>
            <span className="min-w-0 overflow-hidden text-xs font-[730] text-ellipsis whitespace-nowrap">
              {entry.displayName} {entry.isCurrentPlayer ? '(you)' : ''}
            </span>
            <strong className="text-xs tabular-nums text-[#564dd8]">{formatPoints(entry.totalScore)}</strong>
          </li>
        ))}
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
  return (
    <div className="grid min-h-[clamp(440px,calc(100dvh-220px),640px)] place-content-center bg-[#f8f7ff] px-6 text-center">
      <span className="mx-auto mb-5 grid size-18 -rotate-3 place-items-center rounded-[23px_14px_25px_16px] border-2 border-[#17203a] bg-[#cabfff] shadow-[5px_5px_0_#17203a]">
        <Gamepad2 className="size-8 text-[#5148c5]" aria-hidden="true" />
      </span>
      <p className="mb-2 text-[10px] font-[850] tracking-[0.15em] text-[#564dd8] uppercase">Load the cartridge</p>
      <h2 className="m-0 font-display text-[clamp(38px,7vw,68px)] leading-[0.9] font-[910] tracking-[-0.065em]">
        {game.round.artifact.title}
      </h2>
      <p className="mx-auto mt-4 mb-0 max-w-145 text-base leading-[1.5] text-[#687389]">
        {game.round.artifact.instructions}
      </p>
      <p className="mt-6 mb-0 font-display text-4xl font-[920] text-[#ef7543] tabular-nums" aria-live="polite">
        {Math.max(1, Math.ceil((game.round.playStartsAt - now) / 1_000))}
      </p>
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

function RoundResults({ game }: { game: GameView }) {
  if (game.round === null) return null;
  const finishedResults = game.roundResults.filter((result) => result.status !== 'waiting');
  return (
    <div className="min-h-[clamp(440px,calc(100dvh-220px),640px)] bg-[#f8f9ff] p-5 max-[520px]:p-3">
      <div className="mx-auto max-w-190">
        <div className="mb-5 rounded-[14px_9px_15px_10px] border border-[#bfc9d8] bg-white px-4 py-3 text-sm leading-[1.45] text-[#58657b] shadow-[0_3px_0_#d4dbe6]">
          <strong className="text-[#17203a]">What the builder made:</strong> {game.round.artifact.interpretation}
        </div>
        <ol className="m-0 grid list-none gap-2 p-0" aria-label="Round results">
          {finishedResults.map((result, index) => (
            <li
              className={cn(
                'grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-[13px_8px_14px_9px] border border-[#c3ccda] bg-white px-3 py-3 shadow-[0_3px_0_#d7deea]',
                result.isCurrentPlayer && 'border-[#665edb] bg-[#f1efff]'
              )}
              key={result.memberId}
            >
              <span className="grid size-8 place-items-center rounded-full bg-[#17203a] text-[10px] font-[850] text-white">
                {index + 1}
              </span>
              <span className="min-w-0">
                <strong className="block overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                  {result.displayName}
                </strong>
                <small className="block overflow-hidden text-[10px] text-ellipsis whitespace-nowrap text-[#748095]">
                  {result.status === 'timedOut'
                    ? 'Time expired'
                    : result.metricLabel !== null && result.metricValue !== null
                      ? `${result.metricLabel}: ${result.metricValue.toLocaleString()}`
                      : result.elapsedMs === null
                        ? 'Finished'
                        : `${(result.elapsedMs / 1_000).toFixed(1)} seconds`}
                </small>
              </span>
              <strong className="font-display text-lg font-[890] text-[#564dd8] tabular-nums">
                +{formatPoints(result.score)}
              </strong>
            </li>
          ))}
        </ol>
        <p className="mt-5 mb-0 text-center text-xs font-[720] text-[#748095]">
          The next ready cartridge loads automatically.
        </p>
      </div>
    </div>
  );
}

function ActiveRoundSurface({
  game,
  now,
  onFinish,
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
  if (game.phase === 'countdown') {
    content = <CountdownSurface game={game} now={now} />;
  } else if (game.phase === 'roundResults') {
    content = <RoundResults game={game} />;
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
  } else if (game.round.artifact.codeUrl === null) {
    content = (
      <div className="grid min-h-100 place-content-center bg-[#fff2ed] px-6 text-center" role="alert">
        <AlertTriangle className="mx-auto mb-3 size-8 text-[#b54c35]" aria-hidden="true" />
        <h2 className="m-0 font-display text-2xl font-[860]">The game file is unavailable.</h2>
        <p className="mt-2 mb-0 text-sm text-[#7d5d53]">The server will close this round and move on.</p>
      </div>
    );
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
  }

  return (
    <main
      className={cn(
        GAME_LOBBY_FRAME_CLASS,
        'grid grid-cols-[minmax(0,1fr)_260px] items-start gap-4 max-[860px]:grid-cols-1'
      )}
    >
      <section className="overflow-hidden rounded-[20px_13px_22px_15px] border-2 border-[#17203a] bg-white shadow-[7px_7px_0_#17203a]">
        <RoundHeader game={game} now={now} />
        {content}
      </section>
      <RoundStandings standings={game.standings} copied={copied} onInvite={onInvite} />
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
  const podiumEntries = game.standings.slice(0, 3).map((entry) => ({
    id: entry.memberId,
    place: entry.rank,
    name: entry.displayName,
    result: `${formatPoints(entry.totalScore)} points`,
  }));
  return (
    <main
      className={cn(
        GAME_LOBBY_FRAME_CLASS,
        'grid grid-cols-[minmax(0,1fr)_260px] items-start gap-4 max-[860px]:grid-cols-1'
      )}
    >
      <section className="min-w-0">
        <PostGameBoard
          eyebrow="Factory closed · Final scores"
          title={
            game.standings[0] === undefined ? 'Arcade complete.' : `${game.standings[0].displayName} wins the arcade.`
          }
          detail={`${game.summary.played} player-made ${game.summary.played === 1 ? 'game' : 'games'} made it through the playlist.`}
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
          summary={<PostGamePodium entries={podiumEntries} label="Prompt Arcade podium" />}
        />
      </section>
      <RoundStandings standings={game.standings} copied={copied} onInvite={onInvite} />
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
  const timerEnabled = game?.phase === 'countdown' || game?.phase === 'playing';
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
