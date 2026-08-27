export default function MiniGamesCardPreview() {
  return (
    <div className="aspect-[1.35] overflow-hidden rounded-[20px_14px_22px_16px] border border-[#17203a] bg-[#fff9e8] p-3 text-[#17203a] shadow-[6px_7px_0_#ffd6a7]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[7px] font-[860] tracking-[0.12em] text-[#e85d2a] uppercase">13 quick challenges</span>
        <span className="text-sm" aria-hidden="true">
          🎲
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        <span className="grid aspect-[0.86] -rotate-2 place-content-center rounded-[9px_6px_10px_7px] border border-[#17203a] bg-[#bde8ff] text-center shadow-[2px_2px_0_#17203a]">
          <span className="mb-1 text-[11px] text-[#3155d9]">▦</span>
          <b className="text-[6px]">Remember</b>
        </span>
        <span className="grid aspect-[0.86] rotate-1 place-content-center rounded-[7px_11px_8px_12px] border border-[#17203a] bg-[#fff0b8] text-center shadow-[2px_2px_0_#17203a]">
          <span className="mb-1 text-[11px]">📦</span>
          <b className="text-[6px]">Drop it</b>
        </span>
        <span className="grid aspect-[0.86] -rotate-1 place-content-center rounded-[11px_7px_12px_8px] border border-[#17203a] bg-[#d9f7ca] text-center shadow-[2px_2px_0_#17203a]">
          <span className="mb-1 text-[11px] text-[#16815f]">⚡</span>
          <b className="text-[6px]">React</b>
        </span>
      </div>
    </div>
  );
}
