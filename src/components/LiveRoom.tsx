import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function LiveRoom({ url, onLeave, leaveLabel = "Leave" }: { url: string; onLeave: () => void; leaveLabel?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="inline-flex items-center gap-2 font-bold text-background">
          <span className="pulse-dot size-2 rounded-full bg-primary" /> Live class
        </span>
        <Button size="sm" variant="secondary" onClick={onLeave} className="rounded-full font-bold">
          <X className="size-4" /> {leaveLabel}
        </Button>
      </div>
      <iframe
        src={url}
        title="Live class"
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
