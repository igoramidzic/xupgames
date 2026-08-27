export default function TrendlineCardPreview() {
  return (
    <div className="aspect-[1.35] overflow-hidden rounded-[18px_24px_20px_22px] border border-[#183a36] bg-[#f2fcf8] p-3 text-[#183a36] shadow-[6px_7px_0_#bfe3d8]">
      <p className="m-0 text-[8px] font-[860] tracking-[0.12em] text-[#14856a] uppercase">Draw the history</p>
      <div className="mt-1 h-[72%] w-full">
        <svg className="size-full" viewBox="0 0 260 126" aria-hidden="true">
          {[24, 54, 84, 114].map((y) => (
            <line key={y} x1="8" x2="252" y1={y} y2={y} stroke="#c7e5dc" strokeDasharray="4 6" />
          ))}
          <polyline
            points="8,108 43,96 78,103 113,70 148,80 183,47 218,59 252,24"
            fill="none"
            stroke="#f06449"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="8,108 43,101 78,91 113,78 148,65 183,52 218,39 252,28"
            fill="none"
            stroke="#14856a"
            strokeWidth="4"
            strokeDasharray="7 6"
            strokeLinecap="round"
          />
          <circle cx="8" cy="108" r="6" fill="#f4cd54" stroke="#183a36" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}
