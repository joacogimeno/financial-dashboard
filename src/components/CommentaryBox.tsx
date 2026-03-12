import type { Commentary } from "../lib/types";

const ICONS: Record<Commentary["type"], string> = {
  insight: "\uD83D\uDCA1",
  warning: "\u26A0\uFE0F",
  recommendation: "\uD83C\uDFAF",
};

const BORDER_COLORS: Record<Commentary["type"], string> = {
  insight: "border-blue-500/40",
  warning: "border-amber-500/40",
  recommendation: "border-emerald-500/40",
};

const BG_COLORS: Record<Commentary["type"], string> = {
  insight: "bg-blue-950/30",
  warning: "bg-amber-950/30",
  recommendation: "bg-emerald-950/30",
};

const LABELS: Record<Commentary["type"], string> = {
  insight: "DATA INSIGHT",
  warning: "RISK ALERT",
  recommendation: "CFO ACTION",
};

interface Props {
  commentary: Commentary;
}

export default function CommentaryBox({ commentary }: Props) {
  return (
    <div
      className={`rounded-xl border p-5 ${BORDER_COLORS[commentary.type]} ${BG_COLORS[commentary.type]}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{ICONS[commentary.type]}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {LABELS[commentary.type]}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-2">{commentary.title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed">{commentary.text}</p>
    </div>
  );
}
