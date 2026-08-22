import { Check, Pencil } from 'lucide-react';

export default function DoodleDashPreview() {
  return (
    <div className="grid aspect-[1.24] rotate-[0.7deg] grid-cols-[126px_minmax(0,1fr)_150px] gap-4 overflow-hidden rounded-[20px_29px_18px_26px] border border-[#142747] bg-[#fffdf7] p-[clamp(22px,3.7vw,45px)] text-[#142747] shadow-[0_35px_80px_rgb(20_39_71/20%),16px_20px_0_#bdcaf5] max-[520px]:grid-cols-[minmax(0,1fr)_112px] max-[520px]:p-5">
      <div className="flex flex-col gap-2 border-r border-[#e0d8c9] pr-3 max-[520px]:hidden">
        <p className="mb-1 text-[8px] font-[850] tracking-[0.12em] text-[#2748bd]">STANDINGS</p>
        {[
          ['1', 'Maya', '2,840'],
          ['2', 'You', '2,310'],
          ['3', 'Theo', '1,920'],
        ].map(([rank, name, score]) => (
          <p className="grid grid-cols-[15px_1fr_auto] text-[8px] font-[720]" key={name}>
            <span className="text-[#9d8f7a]">{rank}</span>
            <span>{name}</span>
            <strong>{score}</strong>
          </p>
        ))}
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between text-[8px] font-[820] tracking-[0.1em] text-[#786d5c]">
          <span>ROUND 2 · MAYA DRAWS</span>
          <span className="text-[#e84e44]">00:24</span>
        </div>
        <p className="mb-3 text-center font-mono text-[clamp(13px,2vw,22px)] font-[800] tracking-normal [word-spacing:-0.3em]">
          _ E _ _ _ _ _
        </p>
        <div className="relative aspect-[1.55] overflow-hidden rounded-[8px_12px_7px_11px] border border-[#cbbfae] bg-white shadow-[3px_4px_0_#e7ddcf]">
          <svg className="size-full" viewBox="0 0 430 260" aria-hidden="true">
            <path
              d="M78 194 C95 104 160 60 216 79 C270 38 346 96 338 177"
              fill="none"
              stroke="#3155d9"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M80 195 C142 222 277 222 340 178"
              fill="none"
              stroke="#3155d9"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <circle cx="168" cy="142" r="13" fill="#142747" />
            <circle cx="270" cy="142" r="13" fill="#142747" />
            <path d="M188 176 Q220 199 250 173" fill="none" stroke="#ef5b50" strokeWidth="10" strokeLinecap="round" />
          </svg>
          <span className="absolute right-3 bottom-3 grid size-8 -rotate-6 place-items-center rounded-[8px_5px_9px_6px] border border-[#142747] bg-[#f4cd54] shadow-[2px_2px_0_#142747]">
            <Pencil className="size-3.5" />
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col border-l border-[#e0d8c9] pl-3">
        <p className="mb-2 text-[8px] font-[850] tracking-[0.12em] text-[#2748bd]">GUESSES</p>
        <p className="mb-2 text-[8px]">
          <strong>Theo</strong> airplane
        </p>
        <p className="mb-2 text-[8px]">
          <strong>You</strong> whale
        </p>
        <p className="flex items-center gap-1 rounded-md bg-[#dff5e9] px-2 py-1.5 text-[8px] font-[800] text-[#147451]">
          <Check className="size-3" /> Alex got it!
        </p>
        <span className="mt-auto rounded-[7px_4px_8px_5px] border border-[#d6ccbd] bg-white px-2 py-2 text-[8px] text-[#9a8d79]">
          Type your guess…
        </span>
      </div>
    </div>
  );
}
