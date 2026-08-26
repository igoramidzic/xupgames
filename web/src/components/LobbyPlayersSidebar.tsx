import { Check, Copy, UsersRound } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { GAME_LOBBY_SIDEBAR_HEIGHT_CLASS } from '@/lib/gameLobbyLayout';
import type { getRoomMembers } from '@/lib/roomSession';
import { cn } from '@/lib/utils';

type LobbyMember = ReturnType<typeof getRoomMembers>[number];

export type LobbyPlayersSidebarTheme = Partial<{
  background: string;
  border: string;
  shadow: string;
  text: string;
  mutedText: string;
  eyebrow: string;
  divider: string;
  countBackground: string;
  countText: string;
  currentPlayerBackground: string;
  avatarBackground: string;
  avatarBorder: string;
  avatarText: string;
  avatarShadow: string;
  inviteBackground: string;
  inviteHoverBackground: string;
  inviteBorder: string;
  inviteText: string;
}>;

const DEFAULT_THEME: Required<LobbyPlayersSidebarTheme> = {
  background: 'rgb(255 255 255 / 94%)',
  border: '#c1ccdc',
  shadow: '5px 6px 0 rgb(23 32 58 / 8%)',
  text: '#27344e',
  mutedText: '#7b8699',
  eyebrow: '#3155d9',
  divider: '#d5dde8',
  countBackground: '#edf1f7',
  countText: '#536079',
  currentPlayerBackground: '#edf1ff',
  avatarBackground: '#f3cb42',
  avatarBorder: '#17203a',
  avatarText: '#17203a',
  avatarShadow: '2px 2px 0 rgb(23 32 58 / 14%)',
  inviteBackground: '#f8fafd',
  inviteHoverBackground: '#ffffff',
  inviteBorder: '#bdc8d8',
  inviteText: '#34415b',
};

type LobbyPlayersSidebarStyle = CSSProperties & {
  [key: `--lobby-sidebar-${string}`]: string;
};

export default function LobbyPlayersSidebar({
  members,
  activeMemberCount,
  currentMemberId,
  onlineByMemberId,
  readyLabel = 'Ready to vote',
  copied,
  onInvite,
  className,
  theme,
}: {
  members: LobbyMember[];
  activeMemberCount: number;
  currentMemberId: string;
  onlineByMemberId: ReadonlyMap<string, boolean>;
  readyLabel?: string;
  copied: boolean;
  onInvite: () => void;
  className?: string;
  theme?: LobbyPlayersSidebarTheme;
}) {
  const resolvedTheme = { ...DEFAULT_THEME, ...theme };
  const themeStyle: LobbyPlayersSidebarStyle = {
    '--lobby-sidebar-background': resolvedTheme.background,
    '--lobby-sidebar-border': resolvedTheme.border,
    '--lobby-sidebar-shadow': resolvedTheme.shadow,
    '--lobby-sidebar-text': resolvedTheme.text,
    '--lobby-sidebar-muted-text': resolvedTheme.mutedText,
    '--lobby-sidebar-eyebrow': resolvedTheme.eyebrow,
    '--lobby-sidebar-divider': resolvedTheme.divider,
    '--lobby-sidebar-count-background': resolvedTheme.countBackground,
    '--lobby-sidebar-count-text': resolvedTheme.countText,
    '--lobby-sidebar-current-background': resolvedTheme.currentPlayerBackground,
    '--lobby-sidebar-avatar-background': resolvedTheme.avatarBackground,
    '--lobby-sidebar-avatar-border': resolvedTheme.avatarBorder,
    '--lobby-sidebar-avatar-text': resolvedTheme.avatarText,
    '--lobby-sidebar-avatar-shadow': resolvedTheme.avatarShadow,
    '--lobby-sidebar-invite-background': resolvedTheme.inviteBackground,
    '--lobby-sidebar-invite-hover-background': resolvedTheme.inviteHoverBackground,
    '--lobby-sidebar-invite-border': resolvedTheme.inviteBorder,
    '--lobby-sidebar-invite-text': resolvedTheme.inviteText,
  };

  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-[16px_10px_18px_12px] border border-[var(--lobby-sidebar-border)] bg-[var(--lobby-sidebar-background)] text-[var(--lobby-sidebar-text)] shadow-[var(--lobby-sidebar-shadow)]',
        GAME_LOBBY_SIDEBAR_HEIGHT_CLASS,
        className
      )}
      aria-label="Players in the room"
      style={themeStyle}
    >
      <div className="flex items-center justify-between border-b border-[var(--lobby-sidebar-divider)] px-4 py-4">
        <div>
          <p className="mb-0.5 text-[9px] font-[820] tracking-[0.12em] text-[var(--lobby-sidebar-eyebrow)] uppercase">
            In the room
          </p>
          <h2 className="m-0 font-display text-xl font-[800] tracking-[-0.035em]">Players</h2>
        </div>
        <span className="inline-flex items-center gap-1.25 rounded-full bg-[var(--lobby-sidebar-count-background)] px-2.5 py-1.5 text-xs font-[760] text-[var(--lobby-sidebar-count-text)]">
          <UsersRound className="size-3.5" aria-hidden="true" /> {activeMemberCount}
        </span>
      </div>
      <ol className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-3 max-[820px]:max-h-80">
        {members.map((member) => {
          const isCurrentPlayer = member.memberId === currentMemberId;
          const isDisconnected = member.isActive && onlineByMemberId.get(member.memberId) === false;
          return (
            <li
              className={cn(
                'flex min-h-12 items-center gap-2.5 rounded-[10px_7px_11px_8px] px-2.5 py-2',
                isCurrentPlayer && 'bg-[var(--lobby-sidebar-current-background)]',
                !member.isActive && 'opacity-45 grayscale'
              )}
              key={member.memberId}
            >
              <span className="grid size-8.5 shrink-0 place-items-center rounded-[11px_8px_12px_9px] border border-[var(--lobby-sidebar-avatar-border)] bg-[var(--lobby-sidebar-avatar-background)] font-display text-sm font-[850] text-[var(--lobby-sidebar-avatar-text)] shadow-[var(--lobby-sidebar-avatar-shadow)]">
                {member.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="grid min-w-0 flex-1">
                <strong className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[var(--lobby-sidebar-text)]">
                  {member.displayName} {isCurrentPlayer ? '(you)' : ''}
                </strong>
                <small className="text-[10px] font-[650] text-[var(--lobby-sidebar-muted-text)]">
                  {!member.isActive
                    ? 'Left'
                    : isDisconnected
                      ? 'Disconnected'
                      : member.isOwner
                        ? 'Room owner'
                        : readyLabel}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
      <Button
        className="m-3 mt-0 inline-flex h-10 w-[calc(100%-24px)] shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--lobby-sidebar-invite-border)] bg-[var(--lobby-sidebar-invite-background)] px-3 text-xs font-[760] text-[var(--lobby-sidebar-invite-text)] enabled:hover:border-[var(--lobby-sidebar-invite-border)] enabled:hover:bg-[var(--lobby-sidebar-invite-hover-background)] enabled:hover:text-[var(--lobby-sidebar-invite-text)] [&_svg]:size-4"
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
