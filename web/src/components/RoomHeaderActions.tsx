import { DoorOpen, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type PendingRoomAction = 'leave' | 'close' | null;

export default function RoomHeaderActions({
  isOwner,
  isClosed,
  pendingAction,
  onRequestLeave,
  onRequestClose,
}: {
  isOwner: boolean;
  isClosed: boolean;
  pendingAction: PendingRoomAction;
  onRequestLeave: () => void;
  onRequestClose: () => void;
}) {
  return (
    <>
      {isOwner && !isClosed ? (
        <Button
          variant="destructive-soft"
          size="sm"
          className="max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75"
          type="button"
          onClick={onRequestClose}
          disabled={pendingAction !== null}
          aria-label="Close room"
        >
          {pendingAction === 'close' ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LockKeyhole aria-hidden="true" />
          )}
          <span className="max-[760px]:hidden">Close room</span>
        </Button>
      ) : null}
      <Button
        variant="paper"
        size="sm"
        className="max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75"
        type="button"
        onClick={onRequestLeave}
        disabled={pendingAction !== null}
        aria-label="Leave room"
      >
        {pendingAction === 'leave' ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <DoorOpen aria-hidden="true" />
        )}
        <span className="max-[760px]:hidden">Leave room</span>
      </Button>
    </>
  );
}
