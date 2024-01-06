import { LiveImageShape } from "@/components/LiveImageShapeUtil";
import {
	canonicalizeRotation,
	SelectionEdge,
	TLFrameShape,
	toDomPrecision,
	useEditor,
	useIsEditing,
	useValue
} from "@tldraw/editor";
import { preventDefault, stopEventPropagation } from '@tldraw/tldraw'
import { useState } from "react";
import { FrameHeading } from "@/components/FrameHeading";
import { FrameLabelInput } from "@/components/FrameLabelInput";

export const FrameSettings = ({
	shape,
	width,
	height,
}: {
	shape: LiveImageShape
	width: number
	height: number
}) => {
//   always show on the left of the frame
	const {
		id,
		props: {strength},
	} = shape

	const isEditing = useIsEditing(id)

	const [settingsOpen, setSettingsOpen] = useState(false)
	const editor = useEditor()

	const pageRotation = useValue(
		'shape rotation',
		() => canonicalizeRotation(editor.getShapePageTransform(id)!.rotation()),
		[editor, id]
	)

	// rotate right 45 deg
	const offsetRotation = pageRotation + Math.PI / 4
	const scaledRotation = (offsetRotation * (2 / Math.PI) + 4) % 4
	const labelSide: SelectionEdge = (['top', 'left', 'bottom', 'right'] as const)[
		Math.floor(scaledRotation)
		]

	let labelTranslate: string
	switch (labelSide) {
		case 'top':
			labelTranslate = ``
			break
		case 'right':
			labelTranslate = `translate(${toDomPrecision(width)}px, 0px) rotate(90deg)`
			break
		case 'bottom':
			labelTranslate = `translate(${toDomPrecision(width)}px, ${toDomPrecision(
				height
			)}px) rotate(180deg)`
			break
		case 'left':
			labelTranslate = `translate(0px, ${toDomPrecision(height)}px) rotate(270deg)`
			break
	}

	return (
		<>
			<FrameHeading
				id={shape.id}
				name={shape.props.name}
				width={width}
				height={height}
				labelSide={labelSide}
				labelTranslate={labelTranslate}
			/>
			<div
				className="tl-frame-heading"
				style={{
					bottom: 'calc(100% + 2.8em / var(--tl-zoom))',
					transform: `${labelTranslate} scale(var(--tl-scale)) translateX(calc(-0.5 * var(--space-3))`,
					overflow: 'visible',
				}}
			>
				{/*⚙️ a cogwheel button for opening a settings popup */}
				<button
					className="tl-frame-heading-settings-button"
					title="Settings"
					onPointerDown={stopEventPropagation}
					onClick={() => setSettingsOpen(!settingsOpen)}
				>
					⚙️
				</button>
				{settingsOpen && (
					<div style={{
						position: 'relative',
					}} onPointerDown={stopEventPropagation}>
						<div className={"flex flex-col"} style={{
							position: 'absolute',
							bottom: '100%',
						}}>
							<div className={'flex'}>
								<label className="tl-frame-heading-settings-label">
									Seed:
								</label>
								<button
									className="tl-frame-heading-settings-button"
									title="Reroll seed"
									onPointerDown={stopEventPropagation}
									onClick={() => {
										editor.updateShapes(
											[
												{
													id,
													type: 'live-image',
													props: {seed: Math.floor(Math.random() * 10000)},
												},
											],
											{squashing: true}
										)
									}}
								>
									🎲
								</button>
							</div>
							<FrameLabelInput
								type={'number'}
								id={id}
								value={shape.props.seed}
								onValueChange={(value) => {
									const shape = editor.getShape<LiveImageShape>(id)
									if (!shape) return

									const name = shape.props.seed
									if (name === value) return

									editor.updateShapes(
										[
											{
												id,
												type: 'live-image',
												props: {seed: value},
											},
										],
										{squashing: true}
									)
								}}
								showOnlyIfEditing={false}
							/>
							<label className="tl-frame-heading-settings-label">
								AI Strength:
							</label>
							<FrameLabelInput
								type={'number'}
								id={id}
								value={shape.props.strength}
								min={0}
								max={1}
								step={0.01}
								onValueChange={(value) => {
									const shape = editor.getShape<LiveImageShape>(id)
									if (!shape) return

									const name = shape.props.strength
									if (name === value) return

									editor.updateShapes(
										[
											{
												id,
												type: 'live-image',
												props: {strength: value},
											},
										],
										{squashing: true}
									)
								}}
								showOnlyIfEditing={false}
							/>
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={strength}
								className="tl-frame-heading-settings-strength"
								onPointerDown={stopEventPropagation}
								onChange={(e) => {
									const value = parseFloat(e.target.value)
									editor.updateShapes(
										[
											{
												id,
												type: 'live-image',
												props: {strength: value},
											},
										],
										{squashing: true}
									)
								}}
							/>
						</div>
					</div>
				)}
			</div>
		</>
	)
}