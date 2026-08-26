import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { userFacingError } from '@/lib/userFacingError';

type Configuration = {
  roundCount: number;
  roundOptions: Array<{ roundCount: number; estimatedDurationMs: number }>;
};

export function formatMiniGamesDuration(durationMs: number) {
  if (durationMs <= 0) return '0 min';
  const halfMinutes = Math.max(1, Math.round(durationMs / 30_000));
  const wholeMinutes = Math.floor(halfMinutes / 2);
  if (halfMinutes % 2 === 0) return `${wholeMinutes} min`;
  return wholeMinutes === 0 ? '½ min' : `${wholeMinutes}½ min`;
}

export default function MiniGamesConfigurationDialog({
  configuration,
  onSave,
}: {
  configuration: Configuration;
  onSave: (roundCount: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [roundCount, setRoundCount] = useState(configuration.roundCount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function handleOpenChange(nextOpen: boolean) {
    if (saving) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setRoundCount(configuration.roundCount);
      setError(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(roundCount);
      setOpen(false);
    } catch (saveError) {
      setError(userFacingError(saveError, 'Mini-game settings could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="paper" size="sm" className="shrink-0 [&_svg]:size-3.75">
          <Settings2 aria-hidden="true" /> Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(560px,calc(100vw-32px))] max-w-140 gap-0 overflow-hidden rounded-[24px_14px_26px_16px] border border-[#b8c6dc] bg-[#fffdf5] p-0 text-[#17203a] shadow-[9px_10px_0_rgb(23_32_58/16%),0_28px_80px_rgb(23_32_58/24%)] motion-reduce:animate-none">
        <DialogHeader className="border-b border-[#d9dfeb] px-6 pt-6 pr-12 pb-5 text-left max-[520px]:px-4.5">
          <p className="text-[10px] font-[850] tracking-[0.14em] text-[#e85d2a] uppercase">Playlist setup</p>
          <DialogTitle className="font-display text-[34px] leading-none font-[870] tracking-[-0.05em]">
            How many mini-games?
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 px-6 py-5 max-[520px]:px-4.5">
          <fieldset>
            <legend className="mb-3 text-xs font-[820] text-[#40506a]">Rounds in this game</legend>
            <div className="grid grid-cols-4 gap-2 max-[440px]:grid-cols-2">
              {configuration.roundOptions.map((option) => (
                <Button
                  key={option.roundCount}
                  type="button"
                  variant="choice"
                  className="min-h-22 flex-col justify-center gap-0.5 p-2 text-center"
                  data-selected={option.roundCount === roundCount}
                  aria-pressed={option.roundCount === roundCount}
                  aria-label={`${option.roundCount} mini-games, about ${formatMiniGamesDuration(option.estimatedDurationMs)}`}
                  onClick={() => setRoundCount(option.roundCount)}
                >
                  <span className="font-display text-xl font-[880]">{option.roundCount}</span>
                  <span className="text-[9px] font-[720] text-[#77839a]">mini-games</span>
                  <span className="mt-1 text-[9px] font-[820] text-[#3155d9]">
                    ~{formatMiniGamesDuration(option.estimatedDurationMs)}
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>
          {error ? <p className="m-0 text-xs font-[720] text-[#b73c34]">{error}</p> : null}
        </div>
        <DialogFooter className="flex-row justify-end border-t border-[#d9dfeb] bg-[#f5f1e7] px-6 py-4 max-[520px]:px-4.5">
          <Button type="button" variant="paper" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="brand" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save setup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
