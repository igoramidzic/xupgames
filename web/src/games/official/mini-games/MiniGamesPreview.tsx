import { Sparkles } from 'lucide-react';

export default function MiniGamesPreview() {
  return (
    <div className="relative aspect-[1.24] overflow-hidden rounded-[28px_18px_30px_20px] border-2 border-[#17203a] bg-[#fff9e8] p-[clamp(20px,4vw,42px)] text-[#17203a] shadow-[10px_11px_0_#a9c6ff]">
      <span
        className="absolute -top-[18%] -right-[12%] size-[45%] rounded-full border-2 border-[#17203a] bg-[#d9f7ca] opacity-55"
        aria-hidden="true"
      />
      <span
        className="absolute -bottom-[15%] -left-[7%] size-[31%] rotate-12 rounded-[38%_62%_55%_45%] bg-[#ffd6a7] opacity-65"
        aria-hidden="true"
      />

      <div className="relative z-1 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[clamp(8px,1.2vw,11px)] font-[850] tracking-[0.15em] text-[#e85d2a] uppercase">
            Round 3 of 10
          </p>
          <h3 className="m-0 font-display text-[clamp(25px,5vw,48px)] leading-none font-[880] tracking-[-0.055em]">
            What’s next?
          </h3>
        </div>
        <span className="grid size-[clamp(34px,6vw,52px)] shrink-0 -rotate-6 place-items-center rounded-[13px_9px_15px_10px] border-2 border-[#17203a] bg-[#e8e1ff] shadow-[3px_3px_0_#17203a]">
          <Sparkles className="size-[52%] text-[#7455e8]" aria-hidden="true" />
        </span>
      </div>

      <div
        className="relative z-1 mt-[clamp(25px,6vw,64px)] grid grid-cols-[0.88fr_1.12fr_0.88fr] items-center gap-[clamp(8px,2.2vw,20px)] px-[clamp(0px,1vw,10px)]"
        data-mini-game-challenge-grid
        aria-hidden="true"
      >
        <span className="grid aspect-[0.82] min-w-0 -rotate-2 place-content-center rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#bde8ff] p-2 text-center shadow-[clamp(3px,0.8vw,6px)_clamp(3px,0.8vw,6px)_0_#17203a]">
          <span className="mb-[clamp(5px,1.2vw,10px)] text-[clamp(20px,4vw,38px)] text-[#3155d9]">▦</span>
          <strong className="text-[clamp(8px,1.7vw,15px)] leading-tight">Flashback tiles</strong>
        </span>

        <span className="relative grid aspect-[0.82] min-w-0 rotate-1 place-content-center rounded-[14px_21px_16px_23px] border-2 border-[#17203a] bg-[#fff0b8] p-2 text-center shadow-[clamp(4px,1vw,8px)_clamp(4px,1vw,8px)_0_#17203a]">
          <span className="absolute -top-[clamp(9px,1.8vw,15px)] left-1/2 -translate-x-1/2 -rotate-2 rounded-full border-2 border-[#17203a] bg-[#e85d2a] px-[clamp(6px,1.4vw,12px)] py-[clamp(2px,0.5vw,4px)] text-[clamp(6px,1vw,9px)] leading-none font-[900] tracking-[0.12em] whitespace-nowrap text-white uppercase shadow-[2px_2px_0_#17203a]">
            Next up
          </span>
          <span className="mb-[clamp(4px,1vw,9px)] text-[clamp(18px,4.5vw,39px)] leading-none whitespace-nowrap">
            📦
          </span>
          <strong className="text-[clamp(9px,1.9vw,17px)] leading-tight">Drop Zone</strong>
        </span>

        <span className="grid aspect-[0.82] min-w-0 -rotate-1 place-content-center rounded-[20px_12px_22px_14px] border-2 border-[#17203a] bg-[#d9f7ca] p-2 text-center shadow-[clamp(3px,0.8vw,6px)_clamp(3px,0.8vw,6px)_0_#17203a]">
          <span className="mb-[clamp(5px,1.2vw,10px)] text-[clamp(20px,4vw,38px)] text-[#16815f]">⚡</span>
          <strong className="text-[clamp(8px,1.7vw,15px)] leading-tight">Signal Snap</strong>
        </span>
      </div>
    </div>
  );
}
