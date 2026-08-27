import { Check, LoaderCircle, WandSparkles } from 'lucide-react';

export default function PromptArcadeCardPreview() {
  return (
    <div className="aspect-[1.35] overflow-hidden rounded-[18px_13px_20px_15px] border border-[#17203a] bg-[#f7f8ff] p-3 text-[#17203a] shadow-[6px_7px_0_#a8dfdb]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[7px] font-[860] tracking-[0.12em] text-[#b52b68] uppercase">Live game factory</p>
          <strong className="mt-0.5 block font-display text-[11px] leading-none font-[880]">Prompt it. Play it.</strong>
        </div>
        <span className="grid size-6 shrink-0 rotate-3 place-items-center rounded-lg border border-[#17203a] bg-[#ffd75a]">
          <WandSparkles className="size-3" aria-hidden="true" />
        </span>
      </div>
      <div className="relative grid grid-cols-3 gap-1.5" aria-hidden="true">
        <span className="rounded-[7px_5px_8px_6px] border border-[#17203a] bg-[#8be1d2] p-1.5 shadow-[2px_2px_0_#17203a]">
          <Check className="mb-2 size-2.5" />
          <b className="block truncate text-[6px]">Perfect circle</b>
        </span>
        <span className="rounded-[7px_5px_8px_6px] border border-[#17203a] bg-[#ffd75a] p-1.5 shadow-[2px_2px_0_#17203a]">
          <LoaderCircle className="mb-2 size-2.5" />
          <b className="block truncate text-[6px]">Asteroid field</b>
        </span>
        <span className="rounded-[7px_5px_8px_6px] border border-[#17203a] bg-[#cabfff] p-1.5 shadow-[2px_2px_0_#17203a]">
          <span className="mb-2 block text-[8px]">●</span>
          <b className="block truncate text-[6px]">Catch the dot</b>
        </span>
      </div>
    </div>
  );
}
