import { MessageCircle, Pencil } from 'lucide-react';

export default function DoodleDashCardPreview() {
  return (
    <div className="aspect-[1.35] overflow-hidden rounded-[16px_22px_17px_20px] border border-[#263b69] bg-[#fffdf7] p-3 text-[#17203a] shadow-[6px_7px_0_#bdcaf5]">
      <div className="mb-2 flex items-center justify-between text-[7px] font-[850] tracking-[0.11em] text-[#3155d9] uppercase">
        <span>Maya draws</span>
        <span>_ E _ _ _ _ _</span>
      </div>
      <div className="grid min-h-0 grid-cols-[1fr_31%] gap-2">
        <div className="relative overflow-hidden rounded-[8px_11px_9px_10px] border border-[#d6cdbc] bg-white">
          <svg className="size-full" viewBox="0 0 180 96" aria-hidden="true">
            <path
              d="M34 76 C44 31 75 18 91 28 C119 13 151 38 146 73 C120 88 65 89 34 76"
              fill="none"
              stroke="#3155d9"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="76" cy="56" r="5" fill="#17203a" />
            <circle cx="113" cy="56" r="5" fill="#17203a" />
            <path d="M83 70 Q96 80 108 68" fill="none" stroke="#ef5b50" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <span className="absolute right-1.5 bottom-1.5 grid size-5 -rotate-6 place-items-center rounded-md bg-[#f4cd54] text-[#17203a]">
            <Pencil className="size-2.5" aria-hidden="true" />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 text-[7px] text-[#667188]">
          <span className="inline-flex items-center gap-1 font-[820] text-[#3155d9] uppercase">
            <MessageCircle className="size-2.5" aria-hidden="true" /> Guesses
          </span>
          <span className="rounded bg-[#f1f4f8] px-1.5 py-1">airplane</span>
          <span className="rounded bg-[#e3f7ed] px-1.5 py-1 font-[760] text-[#16815f]">Alex got it!</span>
        </div>
      </div>
    </div>
  );
}
