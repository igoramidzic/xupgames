import { cn } from '@/lib/utils';

export default function TypeRacerPreview() {
  const passage = 'All children, except one, grow up.';
  const typedLength = 22;
  const occurrences = new Map<string, number>();
  const characters = Array.from(passage, (character) => {
    const occurrence = (occurrences.get(character) ?? 0) + 1;
    occurrences.set(character, occurrence);
    return { character, key: `${character}-${occurrence}` };
  });

  return (
    <div className="grid aspect-[1.24] rotate-[0.8deg] grid-cols-[minmax(0,1fr)_158px] gap-5 overflow-hidden rounded-[18px_30px_20px_27px] border border-[#2b1b45] bg-[#f9fbff] p-[clamp(24px,3.8vw,48px)] text-[#2b1b45] shadow-[0_35px_80px_rgb(43_27_69/20%),16px_20px_0_#c8d4f0] max-[520px]:grid-cols-1 max-[520px]:p-6">
      <div className="flex min-w-0 flex-col">
        <div className="mb-7 flex items-center justify-between border-b border-[#d9e0f2] pb-3 text-[9px] font-[820] tracking-[0.12em] text-[#746b86]">
          <span>RACE 04 · PHRASE</span>
          <span className="text-[#ff5c57]">62 WPM</span>
        </div>
        <p className="m-0 font-trivia text-[clamp(23px,3.2vw,42px)] leading-[1.5] font-[620] tracking-[-0.025em] whitespace-pre-wrap">
          {characters.map(({ character, key }, index) => (
            <span
              className={cn(
                index < typedLength ? 'bg-[#dff6ec] text-[#211833]' : 'text-[#aaa4b1]',
                index === typedLength && 'border-l-2 border-[#4f6ee8] bg-[#e8edff]'
              )}
              key={key}
            >
              {character}
            </span>
          ))}
        </p>
        <p className="mt-auto mb-0 pt-5 text-[9px] font-[720] text-[#7a718b]">Peter Pan · J. M. Barrie</p>
      </div>
      <div className="flex flex-col gap-3 border-l border-[#d8deef] pl-4 max-[520px]:hidden">
        <p className="m-0 text-[8px] font-[840] tracking-[0.12em] text-[#776f88]">LIVE FIELD</p>
        {[
          { name: 'Maya', progress: 82, color: '#ff5c57' },
          { name: 'You', progress: 61, color: '#4f6ee8' },
          { name: 'Theo', progress: 44, color: '#2da875' },
        ].map((racer, index) => (
          <div key={racer.name}>
            <div className="mb-1 flex justify-between text-[8px] font-[720]">
              <span>
                {index + 1} · {racer.name}
              </span>
              <span>{racer.progress}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-[#e1e6f3]">
              <span
                className="absolute inset-y-0 left-0 rounded-full opacity-75"
                style={{ width: `${racer.progress}%`, backgroundColor: racer.color }}
              />
              <span
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px_6px] border border-[#2b1b45] shadow-[1px_1px_0_#2b1b45]"
                style={{ left: `${racer.progress}%`, backgroundColor: racer.color }}
              />
            </div>
          </div>
        ))}
        <span className="mt-auto rounded-[8px_12px_9px_11px] bg-[#2b1b45] px-3 py-2 text-center text-[8px] font-[800] tracking-[0.08em] text-white">
          SPEED WINS
        </span>
      </div>
    </div>
  );
}
