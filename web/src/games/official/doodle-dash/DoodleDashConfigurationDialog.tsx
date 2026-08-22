import { estimateDoodleDashMinutes } from '@convex/doodleDashEngine';
import { Check, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type DoodleDashConfiguration = {
  categories: string[];
  roundCount: number;
  drawDurationMs: number;
  availableCategories: Array<{ category: string; wordCount: number }>;
  roundOptions: number[];
  drawDurationOptionsMs: number[];
  estimatedMinutes: number;
};

export default function DoodleDashConfigurationDialog({
  configuration,
  playerCount,
  onSave,
}: {
  configuration: DoodleDashConfiguration;
  playerCount: number;
  onSave: (categories: string[], roundCount: number, drawDurationMs: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState(configuration.categories);
  const [roundCount, setRoundCount] = useState(configuration.roundCount);
  const [drawDurationMs, setDrawDurationMs] = useState(configuration.drawDurationMs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimatedMinutes = estimateDoodleDashMinutes(playerCount, roundCount, drawDurationMs);

  function handleOpenChange(nextOpen: boolean) {
    if (saving) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setCategories(configuration.categories);
      setRoundCount(configuration.roundCount);
      setDrawDurationMs(configuration.drawDurationMs);
      setError(null);
    }
  }

  function toggleCategory(category: string) {
    const selected = categories.includes(category);
    if (selected && categories.length === 1) return;
    setCategories(selected ? categories.filter((entry) => entry !== category) : [...categories, category]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(categories, roundCount, drawDurationMs);
      setOpen(false);
    } catch (saveError) {
      setError(userFacingError(saveError, 'Doodle Dash settings could not be saved.'));
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
      <DialogContent className="max-h-[min(760px,calc(100dvh-32px))] w-[min(580px,calc(100vw-32px))] max-w-145 gap-0 overflow-y-auto rounded-[22px_13px_24px_15px] border border-[#c8b9a6] bg-[#fffdf7] p-0 text-[#142747] shadow-[9px_10px_0_rgb(20_39_71/14%),0_28px_80px_rgb(20_39_71/24%)] motion-reduce:animate-none">
        <DialogHeader className="border-b border-[#e4d9ca] px-6 pt-6 pr-12 pb-5 text-left max-[520px]:px-4.5 max-[520px]:pt-5">
          <p className="text-[10px] font-[850] tracking-[0.14em] text-[#2748bd] uppercase">Game configuration</p>
          <DialogTitle className="font-display text-[34px] leading-none font-[850] tracking-[-0.045em]">
            Configure Doodle Dash
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 px-6 py-5 max-[520px]:px-4.5">
          <fieldset>
            <legend className="mb-3 text-xs font-[820] text-[#34445d]">Word categories</legend>
            <div className="grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
              {configuration.availableCategories.map(({ category, wordCount }) => {
                const selected = categories.includes(category);
                const onlySelection = selected && categories.length === 1;
                return (
                  <label
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px_6px_11px_7px] border border-[#d4c8b8] bg-white px-3 py-2 text-xs font-[720] text-[#625a4d] shadow-[0_2px_0_#e7ddd0] transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#3155d9]/25',
                      selected && 'border-[#5270dc] bg-[#edf1ff] text-[#2748bd]',
                      onlySelection && 'cursor-not-allowed'
                    )}
                    key={category}
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={selected}
                      disabled={onlySelection}
                      onChange={() => toggleCategory(category)}
                    />
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-[6px_3px_7px_4px] border border-[#b9ad9e] bg-white',
                        selected && 'border-[#2748bd] bg-[#3155d9] text-white'
                      )}
                      aria-hidden="true"
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{category}</span>
                    <small className="text-[9px] text-[#a09382]">{wordCount}</small>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-[820] text-[#34445d]">Rounds per player</legend>
            <div className="grid grid-cols-3 gap-2">
              {configuration.roundOptions.map((option) => (
                <Button
                  type="button"
                  variant="choice"
                  className="min-h-15 flex-col justify-center gap-0.5 p-2 text-center font-[820]"
                  key={option}
                  data-selected={roundCount === option}
                  aria-pressed={roundCount === option}
                  aria-label={`${option} ${option === 1 ? 'round' : 'rounds'} per player`}
                  onClick={() => setRoundCount(option)}
                >
                  <span className="text-sm">{option}</span>
                  <span className="text-[10px] font-[650] text-[#807463]">
                    {option === 1 ? 'turn each' : 'turns each'}
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-[820] text-[#34445d]">Drawing time</legend>
            <div className="grid grid-cols-3 gap-2">
              {configuration.drawDurationOptionsMs.map((duration) => (
                <Button
                  type="button"
                  variant="choice"
                  className="min-h-15 flex-col justify-center gap-0.5 p-2 text-center font-[820]"
                  key={duration}
                  data-selected={drawDurationMs === duration}
                  aria-pressed={drawDurationMs === duration}
                  aria-label={`${duration / 1_000} seconds to draw`}
                  onClick={() => setDrawDurationMs(duration)}
                >
                  <span className="text-sm">{duration / 1_000}s</span>
                  <span className="text-[10px] font-[650] text-[#807463]">per word</span>
                </Button>
              ))}
            </div>
          </fieldset>

          <p className="m-0 rounded-[10px_7px_11px_8px] bg-[#edf1ff] px-3 py-2.5 text-xs text-[#586783]">
            With {playerCount} {playerCount === 1 ? 'player' : 'players'}, this setup is about{' '}
            <strong>{estimatedMinutes} minutes</strong>. Early guesses can make it shorter.
          </p>
          {error ? <p className="m-0 text-xs font-[720] text-[#b73c34]">{error}</p> : null}
        </div>

        <DialogFooter className="flex-row justify-end border-t border-[#e4d9ca] bg-[#f6f1e9] px-6 py-4 max-[520px]:px-4.5">
          <Button type="button" variant="paper" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="brand" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
