export default function TriviaCardPreview() {
  return (
    <div className="aspect-[1.35] overflow-hidden rounded-[20px_13px_22px_15px] border border-[#142747] bg-[#f8fbff] p-3 font-trivia text-[#10213d] shadow-[6px_7px_0_#c9d8f2]">
      <div className="mb-2 flex items-center justify-between text-[7px] font-[820] tracking-[0.1em] text-[#1a65a8] uppercase">
        <span>Science · 7/10</span>
        <span className="text-[#e24e44]">08.4</span>
      </div>
      <p className="m-0 text-[10px] leading-[1.05] font-[790]">Which planet rotates on its side?</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[6px] font-[700]">
        <span className="rounded border border-[#cbd6e6] bg-white px-1.5 py-1">A · Saturn</span>
        <span className="rounded border border-[#cbd6e6] bg-white px-1.5 py-1">B · Neptune</span>
        <span className="rounded border border-[#cbd6e6] bg-white px-1.5 py-1">C · Mars</span>
        <span className="rounded border border-[#d2a411] bg-[#ffdd61] px-1.5 py-1 shadow-[1px_1px_0_#132746]">
          D · Uranus
        </span>
      </div>
    </div>
  );
}
