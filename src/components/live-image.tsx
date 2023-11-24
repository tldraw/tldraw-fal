/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/rules-of-hooks */
import {
  canonicalizeRotation,
  FrameShapeUtil,
  getDefaultColorTheme,
  getSvgAsImage,
  HTMLContainer,
  SelectionEdge,
  TLEventMapHandler,
  TLFrameShape,
  TLShape,
  useEditor,
} from "@tldraw/tldraw";

import { blobToDataUri } from "@/utils/blob";
import { debounce } from "@/utils/debounce";
import * as fal from "@fal-ai/serverless-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import result from "postcss/lib/result";

// See https://www.fal.ai/models/latent-consistency-sd

const DEBOUNCE_TIME = 0.0; // Adjust as needed
const URL = "wss://110602490-lcm-sd15-i2i.gateway.alpha.fal.ai/ws";

type Input = {
  prompt: string;
  image_url: string;
  sync_mode: boolean;
  seed: number;
  strength?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  enable_safety_checks?: boolean;
};

type Output = {
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  seed: number;
  num_inference_steps: number;
};

export class LiveImageShapeUtil extends FrameShapeUtil {
  static override type = "live-image" as any;

  override getDefaultProps(): { w: number; h: number; name: string } {
    return {
      w: 512,
      h: 512,
      name: "a city skyline",
    };
  }

  override canUnmount = () => false;

  override toSvg(shape: TLFrameShape) {
    const theme = getDefaultColorTheme({
      isDarkMode: this.editor.user.getIsDarkMode(),
    });
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", shape.props.w.toString());
    rect.setAttribute("height", shape.props.h.toString());
    rect.setAttribute("fill", theme.solid);
    g.appendChild(rect);

    return g;
  }

  override component(shape: TLFrameShape) {
    const editor = useEditor();
    const component = super.component(shape);
    const [image, setImage] = useState<string | null>(null);

    const imageDigest = useRef<string | null>(null);
    const startedIteration = useRef<number>(0);
    const finishedIteration = useRef<number>(0);

    //===== SOCKET =====//
    const webSocketRef = useRef<WebSocket | null>(null);
    const isReconnecting = useRef(false);

    const connect = useCallback(() => {
      webSocketRef.current = new WebSocket(
        `wss://tldraw-fal-party.partykit.partykit.dev/party/${
          window.location.pathname.slice(1) || "_default_"
        }`
      );
      // webSocketRef.current = new WebSocket(URL);
      webSocketRef.current.onopen = () => {
        // console.log("WebSocket Open");
      };

      webSocketRef.current.onclose = () => {
        // console.log("WebSocket Close");
      };

      webSocketRef.current.onerror = (error) => {
        // console.error("WebSocket Error:", error);
      };

      webSocketRef.current.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          // console.log("WebSocket Message:", data);
          if (data.images && data.images.length > 0) {
            setImage(data.images[0].url);
          }
        } catch (e) {
          console.error("Error parsing the WebSocket response:", e);
        }
      };
    }, []);

    const disconnect = useCallback(() => {
      webSocketRef.current?.close();
    }, []);

    const sendMessage = useCallback(
      async (message: string) => {
        if (
          !isReconnecting.current &&
          webSocketRef.current?.readyState !== WebSocket.OPEN
        ) {
          isReconnecting.current = true;
          connect();
        }

        if (
          isReconnecting.current &&
          webSocketRef.current?.readyState !== WebSocket.OPEN
        ) {
          await new Promise<void>((resolve) => {
            const checkConnection = setInterval(() => {
              if (webSocketRef.current?.readyState === WebSocket.OPEN) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
          });
          isReconnecting.current = false;
        }
        webSocketRef.current?.send(message);
      },
      [connect]
    );

    const sendCurrentData = useMemo(() => {
      return debounce(sendMessage, DEBOUNCE_TIME);
    }, [sendMessage]);
    //===========//

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onDrawingChange = useCallback(
      debounce(async () => {
        // TODO get actual drawing bounds
        // const bounds = new Box2d(120, 180, 512, 512);

        const iteration = startedIteration.current++;

        const shapes = Array.from(
          editor.getShapeAndDescendantIds([shape.id])
        ).map((id) => editor.getShape(id)) as TLShape[];

        // Check if should submit request
        const shapesDigest = JSON.stringify(shapes);
        if (shapesDigest === imageDigest.current) {
          return;
        }
        imageDigest.current = shapesDigest;

        const svg = await editor.getSvg([shape], {
          background: true,
          padding: 0,
          darkMode: editor.user.getIsDarkMode(),
        });
        if (iteration <= finishedIteration.current) return;

        if (!svg) {
          return;
        }
        const image = await getSvgAsImage(svg, editor.environment.isSafari, {
          type: "png",
          quality: 1,
          scale: 1,
        });

        if (iteration <= finishedIteration.current) return;

        if (!image) {
          return;
        }

        const prompt =
          editor.getShape<TLFrameShape>(shape.id)?.props.name ?? "";
        const imageDataUri = await blobToDataUri(image);

        const request = {
          image_url: imageDataUri,
          prompt,
          sync_mode: true,
          strength: 0.7,
          seed: 42, // TODO make this configurable in the UI
          enable_safety_checks: false,
        };

        sendCurrentData(JSON.stringify(request));

        if (iteration <= finishedIteration.current) return;

        // const result = await fal.run<Input, Output>(LatentConsistency, {
        //   input: {
        //     image_url: imageDataUri,
        //     prompt,
        //     sync_mode: true,
        //     strength: 0.6,
        //     seed: 42, // TODO make this configurable in the UI
        //     enable_safety_checks: false,
        //   },
        //   // Disable auto-upload so we can submit the data uri of the image as is
        //   autoUpload: true,
        // });
        if (iteration <= finishedIteration.current) return;

        finishedIteration.current = iteration;
        // if (result && result.images.length > 0) {
        //   setImage(result.images[0].url);
        // }
      }, 0),
      []
    );

    useEffect(() => {
      const onChange: TLEventMapHandler<"change"> = (event) => {
        if (event.source !== "user") {
          return;
        }
        if (
          Object.keys(event.changes.added).length ||
          Object.keys(event.changes.removed).length ||
          Object.keys(event.changes.updated).length
        ) {
          onDrawingChange();
        }
      };
      editor.addListener("change", onChange);
      return () => {
        editor.removeListener("change", onChange);
      };
    }, [editor, onDrawingChange]);

    return (
      <HTMLContainer>
        <div
          style={{
            display: "flex",
          }}
        >
          {component}

          {image && (
            <img
              src={image}
              alt=""
              width={shape.props.w}
              height={shape.props.h}
              style={{
                position: "relative",
                left: shape.props.w,
                width: shape.props.w,
                height: shape.props.h,
              }}
            />
          )}
        </div>
      </HTMLContainer>
    );
  }
}
