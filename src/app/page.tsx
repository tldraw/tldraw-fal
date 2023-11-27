'use client'

import { LiveImageShape, LiveImageShapeUtil } from '@/components/LiveImageShapeUtil'
import * as fal from '@fal-ai/serverless-client'
import {
	DefaultSizeStyle,
	Editor,
	TLUiOverrides,
	Tldraw,
	toolbarItem,
	useEditor,
} from '@tldraw/tldraw'
import { useEffect } from 'react'
import { LiveImageTool, MakeLiveButton } from '../components/LiveImageTool'

fal.config({
	requestMiddleware: fal.withProxy({
		targetUrl: '/api/fal/proxy',
	}),
})

export const overrides: TLUiOverrides = {
	tools(editor, tools) {
		tools.liveImage = {
			id: 'live-image',
			icon: 'tool-frame',
			label: 'Frame',
			kbd: 'f',
			readonlyOk: false,
			onSelect: () => {
				editor.setCurrentTool('live-image')
			},
		}
		return tools
	},
	toolbar(_app, toolbar, { tools }) {
		const frameIndex = toolbar.findIndex((item) => item.id === 'frame')
		if (frameIndex !== -1) toolbar.splice(frameIndex, 1)
		const highlighterIndex = toolbar.findIndex((item) => item.id === 'highlight')
		if (highlighterIndex !== -1) {
			const highlighterItem = toolbar[highlighterIndex]
			toolbar.splice(highlighterIndex, 1)
			toolbar.splice(3, 0, highlighterItem)
		}
		toolbar.splice(2, 0, toolbarItem(tools.liveImage))
		return toolbar
	},
}

const shapeUtils = [LiveImageShapeUtil]
const tools = [LiveImageTool]

export default function Home() {
	const onEditorMount = (editor: Editor) => {
		// We need the editor to think that the live image shape is a frame
		// @ts-expect-error: patch
		editor.isShapeOfType = function (arg, type) {
			const shape = typeof arg === 'string' ? this.getShape(arg)! : arg
			if (shape.type === 'live-image' && type === 'frame') {
				return true
			}
			return shape.type === type
		}

		// If there isn't a live image shape, create one
		if (!editor.getCurrentPageShapes().some((shape) => shape.type === 'live-image')) {
			editor.createShape<LiveImageShape>({
				type: 'live-image',
				x: 120,
				y: 180,
				props: {
					w: 512,
					h: 512,
					name: 'a city skyline',
				},
			})
		}

		editor.setStyleForNextShapes(DefaultSizeStyle, 'xl', { ephemeral: true })
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-between">
			<div className="fixed inset-0">
				<Tldraw
					persistenceKey="tldraw-fal"
					onMount={onEditorMount}
					shapeUtils={shapeUtils}
					tools={tools}
					shareZone={<MakeLiveButton />}
					overrides={overrides}
				>
					<SneakySideEffects />
				</Tldraw>
			</div>
		</main>
	)
}

function SneakySideEffects() {
	const editor = useEditor()

	useEffect(() => {
		editor.sideEffects.registerAfterChangeHandler('shape', () => {
			editor.emit('update-drawings' as any)
		})
	}, [editor])

	return null
}
