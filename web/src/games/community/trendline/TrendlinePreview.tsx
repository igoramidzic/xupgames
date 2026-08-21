export default function TrendlinePreview() {
  const prediction =
    '40,204 78,190 116,197 154,171 192,155 230,166 268,130 306,144 344,108 382,93 420,112 458,74 496,62 534,79 572,50 610,68 648,42';
  const actual =
    '40,204 78,200 116,191 154,183 192,175 230,161 268,148 306,132 344,121 382,105 420,92 458,80 496,66 534,58 572,51 610,45 648,38';
  return (
    <div className="relative aspect-[1.24] rotate-[0.6deg] overflow-hidden rounded-[20px_28px_22px_26px] border border-[#183a36] bg-[#f6fffb] p-[clamp(22px,3.6vw,46px)] text-[#183a36] shadow-[0_35px_80px_rgb(24_58_54/18%),16px_20px_0_#bfe3d8]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[9px] font-[850] tracking-[0.14em] text-[#158067] uppercase">Technology</p>
          <h3 className="mt-2 mb-0 max-w-105 font-display text-[clamp(20px,3vw,38px)] leading-[0.95] font-[850] tracking-[-0.05em]">
            Internet users in Brazil
          </h3>
        </div>
        <span className="rounded-[8px_12px_9px_11px] border border-[#183a36] bg-[#f4cd54] px-3 py-2 text-[8px] font-[850] tracking-[0.1em] shadow-[2px_2px_0_#183a36]">
          18 SEC
        </span>
      </div>
      <svg
        className="mt-5 w-full overflow-visible"
        viewBox="0 0 688 244"
        role="img"
        aria-label="A predicted line compared with a real historical trend"
      >
        {[44, 84, 124, 164, 204].map((y) => (
          <line key={y} x1="40" x2="648" y1={y} y2={y} stroke="#cce5de" strokeWidth="1" strokeDasharray="5 7" />
        ))}
        <line x1="40" x2="40" y1="36" y2="212" stroke="#7da99d" />
        <line x1="40" x2="648" y1="212" y2="212" stroke="#7da99d" />
        <polyline
          points={prediction}
          fill="none"
          stroke="#f06449"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={actual}
          fill="none"
          stroke="#14856a"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="10 7"
        />
        <circle cx="40" cy="204" r="8" fill="#f4cd54" stroke="#183a36" strokeWidth="3" />
        <text x="40" y="235" fill="#56766f" fontSize="10" fontWeight="700">
          2000
        </text>
        <text x="620" y="235" fill="#56766f" fontSize="10" fontWeight="700">
          2023
        </text>
      </svg>
      <div className="absolute right-8 bottom-5 flex gap-4 text-[8px] font-[800] tracking-[0.08em] uppercase">
        <span className="text-[#f06449]">— Your guess</span>
        <span className="text-[#14856a]">- - History</span>
      </div>
    </div>
  );
}
