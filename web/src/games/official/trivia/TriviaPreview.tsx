import { Timer } from 'lucide-react';

export default function TriviaPreview() {
  return (
    <div className="grid aspect-[1.24] rotate-[-1.2deg] grid-cols-[minmax(0,1fr)_168px] grid-rows-[auto_auto_minmax(0,1fr)] gap-x-6 overflow-hidden rounded-[28px_18px_32px_20px] border border-[#142747] bg-[#f8fbff] p-[clamp(28px,4vw,52px)] font-trivia text-[#10213d] shadow-[0_35px_80px_rgb(11_28_56/22%),16px_20px_0_#132746] max-[520px]:grid-cols-1 max-[520px]:px-6 max-[520px]:py-8">
      <div className="col-start-1 col-end-2 flex items-center justify-between border-b border-[#cfd9e8] pb-3.25 text-[10px] font-[760] tracking-[0.1em] text-[#52647e] max-[520px]:col-start-1 max-[520px]:col-end-2">
        <span>QUESTION 7 / 10</span>
        <span className="inline-flex items-center gap-1.25 tracking-[0.04em] text-[#e24e44] tabular-nums">
          <Timer className="size-3.25" aria-hidden="true" /> 08.4
        </span>
      </div>
      <p className="col-start-1 col-end-2 mt-6.5 mb-2.25 text-[10px] font-[820] tracking-[0.14em] text-[#1a65a8] max-[520px]:col-start-1 max-[520px]:col-end-2">
        SCIENCE
      </p>
      <h2 className="col-start-1 col-end-2 m-0 font-trivia text-[clamp(26px,3vw,43px)] leading-[1.02] font-[790] tracking-[-0.045em] text-[#10213d] [font-stretch:condensed] max-[520px]:col-start-1 max-[520px]:col-end-2">
        Which planet has an axial tilt of roughly 98 degrees?
      </h2>
      <div className="col-start-1 col-end-2 mt-7 grid grid-cols-2 gap-2 self-end max-[520px]:col-start-1 max-[520px]:col-end-2">
        <span className="rounded-[9px_7px_10px_8px] border border-[#cbd6e6] bg-white px-3.25 py-3 text-[11px] font-[680] text-[#3f506a]">
          A · Saturn
        </span>
        <span className="rounded-[9px_7px_10px_8px] border border-[#cbd6e6] bg-white px-3.25 py-3 text-[11px] font-[680] text-[#3f506a]">
          B · Neptune
        </span>
        <span className="rounded-[9px_7px_10px_8px] border border-[#cbd6e6] bg-white px-3.25 py-3 text-[11px] font-[680] text-[#3f506a]">
          C · Mars
        </span>
        <span className="rounded-[9px_7px_10px_8px] border border-[#f0bc17] bg-[#ffdd61] px-3.25 py-3 text-[11px] font-[680] text-[#352900] shadow-[3px_3px_0_#132746]">
          D · Uranus
        </span>
      </div>
      <div className="col-start-2 col-end-3 row-start-1 row-end-[-1] flex flex-col border-l border-[#d6deea] pl-5.5 max-[520px]:hidden">
        <div className="mb-auto rounded-[15px_11px_17px_12px] bg-[#132746] p-4 text-white">
          <small className="mb-1.5 block text-[8px] font-[760] tracking-[0.11em] text-[#8fb6d9]">YOUR SCORE</small>
          <strong className="font-trivia text-[27px] font-[760] tracking-[-0.035em]">4,620</strong>
        </div>
        <p className="mt-1.75 grid grid-cols-[20px_1fr_auto] items-center gap-1.5 border-b border-[#dce3ed] px-1.75 py-2 text-[9px] text-[#65758c]">
          <span className="font-extrabold text-[#8593a6]">1</span> Maya{' '}
          <strong className="text-[#23344f] tabular-nums">5,180</strong>
        </p>
        <p className="mt-1.75 grid grid-cols-[20px_1fr_auto] items-center gap-1.5 rounded-md border-b border-[#dce3ed] bg-[#e8f3ff] px-1.75 py-2 text-[9px] text-[#174e80]">
          <span className="font-extrabold text-[#8593a6]">2</span> You{' '}
          <strong className="text-[#23344f] tabular-nums">4,620</strong>
        </p>
      </div>
    </div>
  );
}
