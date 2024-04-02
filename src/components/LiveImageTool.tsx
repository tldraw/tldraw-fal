import { FrameShapeTool, useEditor } from '@tldraw/tldraw'
import { useCallback } from 'react'

export class LiveImageTool extends FrameShapeTool {
	static override id = 'live-image'
	static override initial = 'idle'
	override shapeType = 'live-image'
}

export function MakeLiveButton() {
	const editor = useEditor()
	const makeLive = useCallback(() => {
		editor.setCurrentTool('live-image')
	}, [editor])

	return (
		<button onClick={makeLive} className="draw-fast-button">
			<div className="draw-fast-button__inner">Draw Faster</div>
		</button>
	)
}
