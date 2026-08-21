import { Check, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type TriviaConfiguration = {
  categories: string[];
  roundCount: number;
  availableCategories: string[];
  categoryQuestionCounts: Array<{ category: string; count: number }>;
  roundOptions: Array<{ roundCount: number; estimatedMinutes: number }>;
  estimatedMinutes: number;
};

export default function TriviaConfigurationDialog({
  configuration,
  onSave,
}: {
  configuration: TriviaConfiguration;
  onSave: (categories: string[], roundCount: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState(configuration.categories);
  const [roundCount, setRoundCount] = useState(configuration.roundCount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryCountByName = new Map(
    configuration.categoryQuestionCounts.map(({ category, count }) => [category, count])
  );
  const availableQuestionCount = categories.reduce(
    (total, category) => total + (categoryCountByName.get(category) ?? 0),
    0
  );

  function handleOpenChange(nextOpen: boolean) {
    if (saving) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setCategories(configuration.categories);
      setRoundCount(configuration.roundCount);
      setError(null);
    }
  }

  function toggleCategory(category: string) {
    const isSelected = categories.includes(category);
    if (isSelected && categories.length === 1) return;
    const nextCategories = isSelected
      ? categories.filter((selectedCategory) => selectedCategory !== category)
      : [...categories, category];
    const nextAvailableQuestionCount = nextCategories.reduce(
      (total, selectedCategory) => total + (categoryCountByName.get(selectedCategory) ?? 0),
      0
    );
    const availableRoundCounts = configuration.roundOptions
      .map((option) => option.roundCount)
      .filter((option) => option <= nextAvailableQuestionCount);
    setCategories(nextCategories);
    if (!availableRoundCounts.includes(roundCount)) {
      setRoundCount(availableRoundCounts.at(-1) ?? configuration.roundOptions[0]?.roundCount ?? 5);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(categories, roundCount);
      setOpen(false);
    } catch (saveError) {
      setError(userFacingError(saveError, 'Trivia settings could not be saved.'));
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
      <DialogContent className="max-h-[min(760px,calc(100dvh-32px))] w-[min(560px,calc(100vw-32px))] max-w-140 gap-0 overflow-y-auto rounded-[22px_13px_24px_15px] border border-[#aebfd0] bg-[#fafdff] p-0 text-[#10213d] shadow-[9px_10px_0_rgb(16_33_61/16%),0_28px_80px_rgb(16_33_61/24%)] motion-reduce:animate-none">
        <DialogHeader className="border-b border-[#d4e0e9] px-6 pt-6 pb-5 pr-12 text-left max-[520px]:px-4.5 max-[520px]:pt-5">
          <p className="text-[10px] font-[850] tracking-[0.14em] text-[#087fa7] uppercase">Game configuration</p>
          <DialogTitle className="font-trivia text-[34px] leading-none font-[820] tracking-[-0.045em]">
            Configure trivia
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 px-6 py-5 max-[520px]:px-4.5">
          <fieldset>
            <legend className="mb-3 text-xs font-[820] text-[#31465f]">Categories</legend>
            <div className="grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
              {configuration.availableCategories.map((category) => {
                const selected = categories.includes(category);
                const isOnlySelection = selected && categories.length === 1;
                return (
                  <label
                    key={category}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px_6px_11px_7px] border border-[#c4d1dd] bg-white px-3 py-2 text-xs font-[720] text-[#50667d] shadow-[0_2px_0_#d7e1e9] transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[rgb(18_168_212/32%)]',
                      selected && 'border-[#168bb5] bg-[#e9f7fc] text-[#145b77]',
                      isOnlySelection && 'cursor-not-allowed'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      disabled={isOnlySelection}
                      onChange={() => toggleCategory(category)}
                    />
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-[6px_3px_7px_4px] border border-[#aebdcb] bg-white',
                        selected && 'border-[#087fa7] bg-[#12a8d4] text-white'
                      )}
                      aria-hidden="true"
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </span>
                    {category}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-[820] text-[#31465f]">Rounds</legend>
            <div className="grid grid-cols-4 gap-2">
              {configuration.roundOptions.map((option) => (
                <Button
                  key={option.roundCount}
                  type="button"
                  variant="choice"
                  className="min-h-15 flex-col justify-center gap-0.5 p-2 text-center font-[820] disabled:cursor-not-allowed disabled:opacity-35"
                  data-selected={roundCount === option.roundCount}
                  aria-pressed={roundCount === option.roundCount}
                  aria-label={`${option.roundCount} rounds, about ${option.estimatedMinutes} minutes`}
                  disabled={option.roundCount > availableQuestionCount}
                  onClick={() => setRoundCount(option.roundCount)}
                >
                  <span className="text-sm">{option.roundCount} rounds</span>
                  <span className="text-[10px] font-[650] text-[#718399]">About {option.estimatedMinutes} min</span>
                </Button>
              ))}
            </div>
          </fieldset>

          {error ? <p className="m-0 text-xs font-[720] text-[#b73c34]">{error}</p> : null}
        </div>

        <DialogFooter className="flex-row justify-end border-t border-[#d4e0e9] bg-[#f1f6fa] px-6 py-4 max-[520px]:px-4.5">
          <Button type="button" variant="paper" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="trivia-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
