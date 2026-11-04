import { LiveKitRoom, RoomAudioRenderer, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

// Browser-only module, loaded through React.lazy from LiveRoom.tsx — never
// imported statically from an SSR route.
export default function LiveKitRoomView({
  serverUrl,
  token,
  audioOnly = false,
}: {
  serverUrl: string;
  token: string;
  audioOnly?: boolean;
}) {
  if (audioOnly) {
    return (
      <div className="hidden" aria-hidden>
        <LiveKitRoom serverUrl={serverUrl} token={token}>
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }
  return (
    <div className="h-full w-full">
      <LiveKitRoom serverUrl={serverUrl} token={token} className="h-full w-full">
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
