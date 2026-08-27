import { BatteryCharging, PencilLine, Sparkles } from 'lucide-react';

export default function MiniGamesPreview() {
  return (
    <div className="relative min-h-76 overflow-hidden rounded-[28px_18px_30px_20px] border-2 border-[#17203a] bg-[#fff9e8] p-6 shadow-[10px_11px_0_#a9c6ff] max-[620px]:min-h-64 max-[620px]:p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[9px] font-[850] tracking-[0.15em] text-[#e85d2a] uppercase">Round 3 of 5</p>
          <h3 className="m-0 font-display text-3xl leading-none font-[880] tracking-[-0.055em] text-[#17203a]">
            What’s next?
          </h3>
        </div>
        <Sparkles className="size-7 text-[#7455e8]" aria-hidden="true" />
      </div>
      <div className="relative mt-9 overflow-hidden py-3" aria-hidden="true">
        <div className="flex w-max -translate-x-24 gap-3">
          <span className="grid h-31 w-48 -rotate-2 place-content-center rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#bde8ff] text-center shadow-[5px_5px_0_#17203a]">
            <PencilLine className="mx-auto mb-2 size-7 text-[#3155d9]" />
            <strong className="text-sm">Straight line</strong>
          </span>
          <span className="grid h-31 w-48 rotate-1 place-content-center rounded-[14px_21px_16px_23px] border-2 border-[#17203a] bg-[#fff0b8] text-center shadow-[5px_5px_0_#17203a]">
            <span className="mb-1 text-3xl">🍊 🫐 🍊</span>
            <strong className="text-sm">Find this emoji</strong>
          </span>
          <span className="grid h-31 w-48 -rotate-1 place-content-center rounded-[20px_12px_22px_14px] border-2 border-[#17203a] bg-[#d9f7ca] text-center shadow-[5px_5px_0_#17203a]">
            <BatteryCharging className="mx-auto mb-2 size-7 text-[#16815f]" />
            <strong className="text-sm">Guess the battery</strong>
          </span>
        </div>
        <span className="absolute top-0 left-1/2 h-full w-0.75 -translate-x-1/2 bg-[#e85d2a]" />
        <span className="absolute top-0 left-1/2 -translate-x-1/2 border-x-8 border-t-10 border-x-transparent border-t-[#e85d2a]" />
      </div>
    </div>
  );
}
