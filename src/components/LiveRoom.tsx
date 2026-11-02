import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Starts as a small floating window so the class page stays usable; expand anytime.
// audioOnly keeps the room connected (tutor's voice) with the video hidden — used during pop quizzes.
// waiting shows students sitting in the join lobby as a banner inside the live window,
// so the tutor can let them in without leaving the class.
export type WaitingStudent = { id: string; name: string; phone: string };

export function LiveRoom({
  url,
  onLeave,
  leaveLabel = "Leave",
  startExpanded = false,
  audioOnly = false,
  waiting,
  onAllowAll,
  onAllowWindow,
  onAllowOne,
  onDenyOne,
}: {
  url: string;
  onLeave: () => void;
  leaveLabel?: string;
  startExpanded?: boolean;
  audioOnly?: boolean;
  waiting?: WaitingStudent[];
  onAllowAll?: () => void;
  onAllowWindow?: (minutes: number) => void;
  onAllowOne?: (id: string) => void;
  onDenyOne?: (id: string) => void;
}) {
  const [big, setBig] = useState(startExpanded);
  if (audioOnly) {
    return (
      <>
        <iframe src={url} title="Live class audio" allow="camera; microphone; autoplay" className="pointer-events-none fixed size-px opacity-0" aria-hidden />
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border-2 border-foreground bg-foreground px-4 py-2 shadow-2xl">
          <span className="pulse-dot size-2 rounded-full bg-primary" />
          <span className="text-sm font-bold text-background">Live class audio</span>
          <Button size="sm" variant="secondary" onClick={onLeave} className="h-7 rounded-full px-2 font-bold" aria-label="Leave live class">
            <X className="size-4" />
          </Button>
        </div>
      </>
    );
  }
  const panel = <WaitingPanel waiting={waiting} onAllowAll={onAllowAll} onAllowWindow={onAllowWindow} onAllowOne={onAllowOne} onDenyOne={onDenyOne} />;
  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden bg-foreground shadow-2xl",
        big ? "inset-0" : "bottom-4 right-4 max-h-[min(420px,calc(100vh-2rem))] h-[230px] w-[min(380px,calc(100vw-2rem))] rounded-2xl border-2 border-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-background">
          <span className="pulse-dot size-2 rounded-full bg-primary" /> Live class
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setBig(!big)} className="h-7 rounded-full px-2 font-bold" aria-label={big ? "Minimise" : "Expand"}>
            {big ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button size="sm" variant="secondary" onClick={onLeave} className="h-7 rounded-full px-2 font-bold">
            <X className="size-4" /> {big && leaveLabel}
          </Button>
        </div>
      </div>
      {panel}
      <iframe src={url} title="Live class" allow="camera; microphone; fullscreen; display-capture; autoplay" className="w-full flex-1 border-0" />
    </div>
  );
}

function WaitingPanel({
  waiting,
  onAllowAll,
  onAllowWindow,
  onAllowOne,
  onDenyOne,
}: {
  waiting?: WaitingStudent[] | undefined;
  onAllowAll?: (() => void) | undefined;
  onAllowWindow?: ((minutes: number) => void) | undefined;
  onAllowOne?: ((id: string) => void) | undefined;
  onDenyOne?: ((id: string) => void) | undefined;
}) {
  if (!waiting || waiting.length === 0) return null;
  return (
    <div className="border-y border-background/20 bg-foreground px-3 py-2 text-background">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-background/80">
        <span className="pulse-dot size-2 rounded-full bg-primary" />
        {waiting.length} {waiting.length === 1 ? "student is" : "students are"} waiting to join your class
      </p>
      <div className="mt-1 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
        {waiting.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-xs font-bold text-background">
            {m.name}
            <button aria-label={`Let ${m.name} in`} title="Let in" onClick={() => onAllowOne?.(m.id)} className="text-secondary hover:text-primary">
              <Check className="size-3.5" />
            </button>
            <button aria-label={`Decline ${m.name}`} title="Decline" onClick={() => onDenyOne?.(m.id)} className="text-background/70 hover:text-primary">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Button size="sm" onClick={onAllowAll} className="h-7 rounded-full px-3 text-xs font-bold">
          Let everyone in
        </Button>
        <span className="text-xs font-bold text-background/60">or open the door for</span>
        <Button size="sm" variant="secondary" onClick={() => onAllowWindow?.(15)} className="h-7 rounded-full px-3 text-xs font-bold">15 min</Button>
        <Button size="sm" variant="secondary" onClick={() => onAllowWindow?.(30)} className="h-7 rounded-full px-3 text-xs font-bold">30 min</Button>
        <Button size="sm" variant="secondary" onClick={() => onAllowWindow?.(60)} className="h-7 rounded-full px-3 text-xs font-bold">1 hour</Button>
      </div>
    </div>
  );
}
