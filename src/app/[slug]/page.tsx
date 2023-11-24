"use client";

import { LiveImageShapeUtil } from "@/components/live-image";
import * as fal from "@fal-ai/serverless-client";
import { Editor, FrameShapeTool, Tldraw, useEditor } from "@tldraw/tldraw";
import { useCallback } from "react";
import { LiveImageTool, MakeLiveButton } from "../../components/LiveImageTool";
import { useYjsStore } from "../../useYjsStore";

fal.config({
  requestMiddleware: fal.withProxy({
    targetUrl: "/api/fal/proxy",
  }),
});

const HOST_URL = "wss://tldraw-fal-party.partykit.partykit.dev/parties/yjs";

const shapeUtils = [LiveImageShapeUtil];
const tools = [LiveImageTool];

export default function Home(props: { params: Record<string, string> }) {
  const store = useYjsStore({
    roomId: props.params.slug,
    hostUrl: HOST_URL,
    shapeUtils,
  });

  const onEditorMount = (editor: Editor) => {
    // If there isn't a live image shape, create one
    const liveImage = editor.getCurrentPageShapes().find((shape) => {
      return shape.type === "live-image";
    });

    if (liveImage) {
      return;
    }

    editor.createShape({
      type: "live-image",
      x: 120,
      y: 180,
      props: {
        w: 512,
        h: 512,
        name: "a city skyline",
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="fixed inset-0">
        <Tldraw
          // persistenceKey="tldraw-fal"
          onMount={onEditorMount}
          shapeUtils={shapeUtils}
          tools={tools}
          store={store}
          shareZone={<MakeLiveButton />}
        />
      </div>
    </main>
  );
}
