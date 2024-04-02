/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/rules-of-hooks */
import {
	AssetRecordType,
	Button,
	Geometry2d,
	getDefaultColorTheme,
	Rectangle2d,
	resizeBox,
	ShapeUtil,
	SVGContainer,
	TLBaseShape,
	TLGroupShape,
	TLOnResizeEndHandler,
	TLOnResizeHandler,
	TLShape,
	TLShapeId,
	toDomPrecision,
	useEditor,
	useIsDarkMode,
} from '@tldraw/tldraw'

import { useLiveImage } from '@/hooks/useLiveImage'
import { FrameHeading } from './FrameHeading'

// See https://www.fal.ai/models/latent-consistency-sd

type Input = {
	prompt: string
	image_url: string
	sync_mode: boolean
	seed: number
	strength?: number
	guidance_scale?: number
	num_inference_steps?: number
	enable_safety_checks?: boolean
}

type Output = {
	images: Array<{
		url: string
		width: number
		height: number
	}>
	seed: number
	num_inference_steps: number
}

export type LiveImageShape = TLBaseShape<
	'live-image',
	{
		w: number
		h: number
		name: string
		overlayResult?: boolean
		src?: string
	}
>

export class LiveImageShapeUtil extends ShapeUtil<LiveImageShape> {
	static type = 'live-image' as any

	override canBind = () => false
	override canUnmount = () => false
	override canEdit = () => true
	override isAspectRatioLocked = () => true

	getDefaultProps() {
		return {
			w: 512,
			h: 512,
			name: '',
		}
	}

	override getGeometry(shape: LiveImageShape): Geometry2d {
		return new Rectangle2d({
			width: shape.props.w,
			height: shape.props.h,
			isFilled: false,
		})
	}

	override canReceiveNewChildrenOfType = (shape: TLShape, _type: TLShape['type']) => {
		return !shape.isLocked
	}

	providesBackgroundForChildren(): boolean {
		return true
	}

	override canDropShapes = (shape: LiveImageShape, _shapes: TLShape[]): boolean => {
		return !shape.isLocked
	}

	override onDragShapesOver = (
		frame: LiveImageShape,
		shapes: TLShape[]
	): { shouldHint: boolean } => {
		if (!shapes.every((child) => child.parentId === frame.id)) {
			this.editor.reparentShapes(
				shapes.map((shape) => shape.id),
				frame.id
			)
			return { shouldHint: true }
		}
		return { shouldHint: false }
	}

	override onDragShapesOut = (_shape: LiveImageShape, shapes: TLShape[]): void => {
		const parent = this.editor.getShape(_shape.parentId)
		const isInGroup = parent && this.editor.isShapeOfType<TLGroupShape>(parent, 'group')
		if (isInGroup) {
			this.editor.reparentShapes(shapes, parent.id)
		} else {
			this.editor.reparentShapes(shapes, this.editor.getCurrentPageId())
		}
	}

	override onResizeEnd: TLOnResizeEndHandler<LiveImageShape> = (shape) => {
		const bounds = this.editor.getShapePageBounds(shape)!
		const children = this.editor.getSortedChildIdsForParent(shape.id)

		const shapesToReparent: TLShapeId[] = []

		for (const childId of children) {
			const childBounds = this.editor.getShapePageBounds(childId)!
			if (!bounds.includes(childBounds)) {
				shapesToReparent.push(childId)
			}
		}

		if (shapesToReparent.length > 0) {
			this.editor.reparentShapes(shapesToReparent, this.editor.getCurrentPageId())
		}
	}

	override onResize: TLOnResizeHandler<any> = (shape, info) => {
		return resizeBox(shape, info)
	}

	indicator(shape: LiveImageShape) {
		const bounds = this.editor.getShapeGeometry(shape).bounds

		return (
			<rect
				width={toDomPrecision(bounds.width)}
				height={toDomPrecision(bounds.height)}
				className={`tl-frame-indicator`}
			/>
		)
	}

	override component(shape: LiveImageShape) {
		const editor = useEditor()

		useLiveImage(shape.id)

		const bounds = this.editor.getShapeGeometry(shape).bounds
		const assetId = AssetRecordType.createId(shape.id.split(':')[1])
		const asset = editor.getAsset(assetId)

		const theme = getDefaultColorTheme({ isDarkMode: useIsDarkMode() })

		return (
			<>
				<SVGContainer>
					<rect
						className={'tl-frame__body'}
						width={bounds.width}
						height={bounds.height}
						fill={theme.solid}
						stroke={theme.text}
					/>
				</SVGContainer>
				<FrameHeading
					id={shape.id}
					name={shape.props.name}
					width={bounds.width}
					height={bounds.height}
				/>

				<img
					src={shape.props.src!}
					alt={shape.props.name}
					width={shape.props.w}
					height={shape.props.h}
					style={{
						position: 'absolute',
						left: shape.props.overlayResult ? 0 : shape.props.w,
						width: shape.props.w,
						height: shape.props.h,
						zIndex: shape.props.overlayResult ? 9999999 : 'inherit',
					}}
				/>

				<Button
					type="icon"
					icon={shape.props.overlayResult ? 'chevron-right' : 'chevron-left'}
					style={{
						position: 'absolute',
						top: -4,
						left: shape.props.overlayResult ? shape.props.w : shape.props.w * 2,
						pointerEvents: 'auto',
						transform: 'scale(var(--tl-scale))',
						transformOrigin: '0 4px',
					}}
					onPointerDown={(e) => {
						e.stopPropagation()
					}}
					onClick={(e) => {
						editor.updateShape<LiveImageShape>({
							id: shape.id,
							type: 'live-image',
							props: { overlayResult: !shape.props.overlayResult },
						})
					}}
				/>
			</>
		)
	}
}
