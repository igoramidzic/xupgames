export default function TypeRacerCardPreview() {
  return (
    <div className="aspect-[1.35] overflow-hidden rounded-[14px_21px_16px_19px] border border-[#2b1b45] bg-[#f9fbff] p-3 text-[#2b1b45] shadow-[6px_7px_0_#c8d4f0]">
      <div className="mb-3 flex items-center justify-between text-[7px] font-[840] tracking-[0.1em] text-[#746b86] uppercase">
        <span>Race 04</span>
        <span className="text-[#ef493f]">62 WPM</span>
      </div>
      <p className="m-0 font-trivia text-[11px] leading-[1.35] font-[680]">
        <span className="bg-[#dff6ec] text-[#211833]">All children, except </span>
        <span className="border-l-2 border-[#4f6ee8] bg-[#e8edff]">o</span>
        <span className="text-[#aaa4b1]">ne, grow up.</span>
      </p>
      <div className="mt-3 grid gap-1" aria-hidden="true">
        <span className="h-1.5 w-[82%] rounded-full bg-[#ef493f]" />
        <span className="h-1.5 w-[61%] rounded-full bg-[#4f6ee8]" />
        <span className="h-1.5 w-[44%] rounded-full bg-[#2da875]" />
      </div>
    </div>
  );
}
