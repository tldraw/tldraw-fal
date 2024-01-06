import {
	SelectionEdge,
	TLShapeId,
	getPointerInfo,
	useEditor,
	useIsEditing,
	TLFrameShape,
} from '@tldraw/editor'
import { preventDefault, stopEventPropagation } from '@tldraw/tldraw'
import { useCallback, useEffect, useRef } from 'react'
import { FrameLabelInput } from './FrameLabelInput'

export function FrameHeading({
	id,
	name,
	width,
	height,
	labelSide,
	labelTranslate,
}: {
	id: TLShapeId
	name: string
	width: number
	height: number
	labelSide: SelectionEdge
	labelTranslate: string
}) {
	const editor = useEditor()

	const isEditing = useIsEditing(id)

	const rInput = useRef<HTMLInputElement>(null)

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			preventDefault(e)
			stopEventPropagation(e)

			const event = getPointerInfo(e)

			// If we're editing the frame label, we shouldn't hijack the pointer event
			if (editor.getEditingShapeId() === id) return

			editor.dispatch({
				...event,
				type: 'pointer',
				name: 'pointer_down',
				target: 'shape',
				shape: editor.getShape(id)!,
			})
		},
		[editor, id]
	)

	useEffect(() => {
		const el = rInput.current
		if (el && isEditing) {
			// On iOS, we must focus here
			el.focus()
			el.select()

			requestAnimationFrame(() => {
				// On desktop, the input may have lost focus, so try try try again!
				if (document.activeElement !== el) {
					el.focus()
					el.select()
				}
			})
		}
	}, [rInput, isEditing])

	return (
		<div
			className="tl-frame-heading"
			style={{
				overflow: isEditing ? 'visible' : 'hidden',
				maxWidth: `calc(var(--tl-zoom) * ${
					labelSide === 'top' || labelSide === 'bottom' ? Math.ceil(width) : Math.ceil(height)
				}px + var(--space-5))`,
				bottom: '100%',
				transform: `${labelTranslate} scale(var(--tl-scale)) translateX(calc(-1 * var(--space-3))`,
			}}
			onPointerDown={handlePointerDown}
		>
			<div className="tl-frame-heading-hit-area">
				<FrameLabelInput
					type={'text'}
					ref={rInput}
					id={id}
					value={name}
					onValueChange={(value) => {
						const shape = editor.getShape<TLFrameShape>(id)
						if (!shape) return

						const name = shape.props.name
						if (name === value) return

						editor.updateShapes(
							[
								{
									id,
									type: 'frame',
									props: {name: value},
								},
							],
							{squashing: true}
						)
					}}
					placeholder={'Double click prompt to edit'}
					showOnlyIfEditing={true}
				/>
			</div>
		</div>
	)
}
