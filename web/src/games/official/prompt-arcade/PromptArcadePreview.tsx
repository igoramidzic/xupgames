import { Check, LoaderCircle, Sparkles, WandSparkles } from 'lucide-react';

const CARTRIDGES = [
  { name: 'Perfect circle', state: 'READY', color: '#8be1d2', icon: Check },
  { name: 'Tiny asteroid field', state: 'BUILDING', color: '#ffd75a', icon: LoaderCircle },
  { name: 'Catch the blue dot', state: 'CHECKING', color: '#cabfff', icon: Sparkles },
] as const;

export default function PromptArcadePreview() {
  return (
    <div className="relative min-h-76 overflow-hidden rounded-[26px_17px_29px_20px] border-2 border-[#17203a] bg-[#f7f8ff] p-6 text-[#17203a] shadow-[11px_12px_0_#a8dfdb] max-[620px]:min-h-66 max-[620px]:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[9px] font-[860] tracking-[0.15em] text-[#564dd8] uppercase">Live game factory</p>
          <h3 className="m-0 max-w-90 font-display text-[clamp(28px,4vw,40px)] leading-[0.92] font-[900] tracking-[-0.06em]">
            You prompt it.
            <br />
            We play it.
          </h3>
        </div>
        <span className="grid size-11 shrink-0 rotate-3 place-items-center rounded-[14px_9px_15px_10px] border-2 border-[#17203a] bg-[#ffd75a] shadow-[3px_3px_0_#17203a]">
          <WandSparkles className="size-5 text-[#564dd8]" aria-hidden="true" />
        </span>
      </div>

      <div className="relative mt-7" aria-hidden="true">
        <div className="absolute top-1/2 right-0 left-0 h-8 -translate-y-1/2 rounded-full border-2 border-[#17203a] bg-[#303b55] shadow-[0_4px_0_#a9b4c8]">
          <div className="flex h-full items-center justify-around px-3">
            {[0, 1, 2, 3, 4, 5, 6].map((roller) => (
              <span className="size-3 rounded-full border border-[#17203a] bg-[#e6ebf5]" key={roller} />
            ))}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2.5 px-2 max-[420px]:gap-1.5">
          {CARTRIDGES.map(({ name, state, color, icon: Icon }, index) => (
            <article
              className="min-w-0 rounded-[13px_8px_14px_9px] border-2 border-[#17203a] px-3 py-3 shadow-[4px_4px_0_#17203a] max-[420px]:px-2"
              key={name}
              style={{
                backgroundColor: color,
                transform: `rotate(${index === 1 ? 1.5 : index === 0 ? -1.5 : -0.5}deg)`,
              }}
            >
              <Icon className="mb-4 size-4 text-[#17203a]" aria-hidden="true" />
              <strong className="block overflow-hidden text-[10px] leading-[1.15] font-[820] text-ellipsis whitespace-nowrap">
                {name}
              </strong>
              <span className="mt-1 block text-[7px] font-[900] tracking-[0.12em] text-[#505a6f]">{state}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
