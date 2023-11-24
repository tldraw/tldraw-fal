"use client";

import { LiveImageShapeUtil } from "@/components/live-image";
import * as fal from "@fal-ai/serverless-client";
import { Editor, FrameShapeTool, Tldraw, useEditor } from "@tldraw/tldraw";
import { useCallback } from "react";
import { LiveImageTool, MakeLiveButton } from "../components/LiveImageTool";

fal.config({
  requestMiddleware: fal.withProxy({
    targetUrl: "/api/fal/proxy",
  }),
});

const shapeUtils = [LiveImageShapeUtil];
const tools = [LiveImageTool];

export default function Home() {
  const onEditorMount = (editor: Editor) => {
    // @ts-expect-error: patch
    editor.isShapeOfType = function (arg, type) {
      const shape = typeof arg === "string" ? this.getShape(arg)! : arg;
      if (shape.type === "live-image" && type === "frame") {
        return true;
      }
      return shape.type === type;
    };

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
          persistenceKey="tldraw-fal"
          onMount={onEditorMount}
          shapeUtils={shapeUtils}
          tools={tools}
          shareZone={<MakeLiveButton />}
        />
      </div>
    </main>
  );
}
