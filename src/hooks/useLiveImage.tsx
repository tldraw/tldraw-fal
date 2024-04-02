import { LiveImageShape } from '@/components/LiveImageShapeUtil'
import * as fal from '@fal-ai/serverless-client'
import { RealtimeConnection } from '@fal-ai/serverless-client/src/realtime'
import { Editor, TLShape, TLShapeId, getHashForObject, useEditor } from '@tldraw/tldraw'
import { createContext, useContext, useEffect, useState } from 'react'

type LCMInput = {
	prompt: string
	image: Uint8Array
	strength?: number
	negative_prompt?: string
	seed?: number | null
	guidance_scale?: number
	num_inference_steps?: number
	enable_safety_checks?: boolean
	request_id?: string
	height?: number
	width?: number
}

type LCMOutput = {
	image: Uint8Array
	timings: Record<string, number>
	seed: number
	num_inference_steps: number
	request_id: string
	nsfw_content_detected: boolean[]
}

type Send = (req: LCMInput) => void

type LiveImageContextType = RealtimeConnection<LCMInput> | null
const LiveImageContext = createContext<LiveImageContextType>(null)

export function LiveImageProvider({ children }: { children: React.ReactNode }) {
	// const [count, setCount] = useState(0)
	// const [fetchImage, setFetchImage] = useState<{ current: LiveImageContextType }>({ current: null })

	const [connection, setConnection] = useState<RealtimeConnection<LCMInput> | null>(null)

	useEffect(() => {
		// const requestsById = new Map<
		// 	string,
		// 	{
		// 		resolve: (result: LiveImageResult) => void
		// 		reject: (err: unknown) => void
		// 		timer: ReturnType<typeof setTimeout>
		// 	}
		// >()

		const _connection = fal.realtime.connect<LCMInput, LCMOutput>(
			'fal-ai/sd-turbo-real-time-high-fps-msgpack-a10g',
			{
				connectionKey: 'draw-faster',
				throttleInterval: 0,
				onError: (error) => {
					console.error(error)
				},
				onResult: (result) => {
					if (result.image) {
						const blob = new Blob([result.image], { type: 'image/jpeg' })
						const url = URL.createObjectURL(blob)
						// @ts-expect-error: yolo
						updateGeneratedImage(window.editor, result.request_id as TLShapeId, url)
					}

					// console.log(result)
					// if (result.images && result.images[0]) {
					// 	const id = result.request_id
					// 	const request = requestsById.get(id)
					// 	if (request) {
					// 		request.resolve(result.images[0])
					// 	}
					// }
				},
			}
		)

		setConnection(_connection)

		// setSend(connection.send)

		// setFetchImage({
		// 	current: (req) => {
		// 		return new Promise((resolve, reject) => {
		// 			const id = uuid()
		// 			const timer = setTimeout(() => {
		// 				requestsById.delete(id)
		// 				reject(new Error('Timeout'))
		// 			}, timeoutTime)
		// 			requestsById.set(id, {
		// 				resolve: (res) => {
		// 					resolve(res)
		// 					clearTimeout(timer)
		// 				},
		// 				reject: (err) => {
		// 					reject(err)
		// 					clearTimeout(timer)
		// 				},
		// 				timer,
		// 			})
		// 			send({ ...req, request_id: id })
		// 		})
		// 	},
		// })

		return () => {
			_connection.close()
			setConnection(null)
		}
	}, [])

	return <LiveImageContext.Provider value={connection}>{children}</LiveImageContext.Provider>
}

export function useLiveImage(shapeId: TLShapeId) {
	const editor = useEditor()
	const connection = useContext(LiveImageContext)
	if (!connection) throw new Error('Missing LiveImageProvider')
	const send = connection.send
	if (!send) throw new Error('Missing LiveImageProvider')
	useEffect(() => {
		const _canvas = document.createElement('canvas')
		const _ctx = _canvas.getContext('2d')!

		let prevHash = ''
		let prevPrompt = ''
		let startedIteration = 0
		let finishedIteration = 0
		async function updateDrawing() {
			if (!send) throw new Error('Missing LiveImageProvider')
			const shapes = getShapesTouching(shapeId, editor)
			const frame = editor.getShape<LiveImageShape>(shapeId)!
			const hash = getHashForObject([...shapes])
			const frameName = frame.props.name
			if (hash === prevHash && frameName === prevPrompt) return

			startedIteration += 1
			const iteration = startedIteration
			prevHash = hash
			prevPrompt = frame.props.name
			try {
				const svg = await editor.getSvg([...shapes], {
					background: true,
					padding: 0,
					darkMode: editor.user.getIsDarkMode(),
					bounds: editor.getShapePageBounds(shapeId)!,
				})
				// cancel if stale:
				if (iteration <= finishedIteration) return
				if (!svg) {
					console.error('No SVG')
					updateGeneratedImage(editor, frame.id, '')
					return
				}
				const blobPromise = _getSvgAsImage(svg, editor.environment.isSafari, _canvas, _ctx, {
					type: 'jpeg',
					quality: 0.5,
					scale: 512 / frame.props.w,
					// scale: 256 / frame.props.w,
				})

				blobPromise.then(async (blob) => {
					// cancel if stale:
					if (iteration <= finishedIteration) return

					if (!blob) {
						console.error('No image')
						updateGeneratedImage(editor, frame.id, '')
						return
					}

					// cancel if stale:
					if (iteration <= finishedIteration) return

					const buffer = await blob.arrayBuffer()

					// cancel if stale:
					if (iteration <= finishedIteration) return

					const data = new Uint8Array(buffer)
					// const prompt = frameName ? frameName : 'A person'

					const prompt = frameName
						? frameName + ' hd award-winning impressive'
						: 'A random image that is safe for work and not surprising—something boring like a city or shoe watercolor'

					// downloadDataURLAsFile(imageDataUri, 'image.png')
					send({
						prompt,
						image: data,
						seed: 42,
						enable_safety_checks: false,
						guidance_scale: 1.0,
						request_id: shapeId,

						//--- FOR DOODLING ON IMAGES ---
						strength: 0.666666,
						num_inference_steps: 3,

						//--- FOR DRAWING FROM SCRATCH ---
						// strength: 0.71,
						// num_inference_steps: 5,
					})

					// cancel if stale:
					if (iteration <= finishedIteration) return
					finishedIteration = iteration
				})
			} catch (e) {
				throw e
			}
		}

		// let timer: ReturnType<typeof setTimeout> | null = null
		// function requestUpdate() {
		// 	// updateDrawing()
		// 	console.log('send' + Math.random())
		// 	if (timer !== null) return
		// 	timer = setTimeout(() => {
		// 		timer = null
		// 		updateDrawing()
		// 	}, 16)
		// }

		const interval = setInterval(() => {
			updateDrawing()
		}, 64)
		// editor.on('update-drawings' as any, requestUpdate)
		return () => {
			clearInterval(interval)
			// editor.off('update-drawings' as any, requestUpdate)
		}
	}, [editor, shapeId, send])
}

export async function _getSvgAsImage(
	svg: SVGElement,
	isSafari: boolean,
	_canvas: HTMLCanvasElement,
	_ctx: CanvasRenderingContext2D,
	options: {
		type: 'png' | 'jpeg' | 'webp'
		quality: number
		scale: number
	}
) {
	const { type, quality, scale } = options

	const width = +svg.getAttribute('width')!
	const height = +svg.getAttribute('height')!
	let [clampedWidth, clampedHeight] = [width * scale, height * scale]
	clampedWidth = Math.floor(clampedWidth)
	clampedHeight = Math.floor(clampedHeight)

	const svgString = await _getSvgAsString(svg)
	const svgUrl = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))

	const canvas = await new Promise<HTMLCanvasElement | null>((resolve) => {
		const image = new Image()
		image.crossOrigin = 'anonymous'

		image.onload = async () => {
			const canvas = _canvas
			const ctx = _ctx

			canvas.width = clampedWidth
			canvas.height = clampedHeight

			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = 'high'
			ctx.drawImage(image, 0, 0, clampedWidth, clampedHeight)

			URL.revokeObjectURL(svgUrl)

			resolve(canvas)
		}

		image.onerror = () => {
			resolve(null)
		}

		image.src = svgUrl
	})

	if (!canvas) return null

	const blobPromise = new Promise<Blob | null>((resolve) =>
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					resolve(null)
				}
				resolve(blob)
			},
			'image/' + type,
			quality
		)
	)

	return blobPromise
	// const view = new DataView(await blob.arrayBuffer())
	// return PngHelpers.setPhysChunk(view, effectiveScale, {
	// 	type: 'image/' + type,
	// })
}

async function _getSvgAsString(svg: SVGElement) {
	const clone = svg.cloneNode(true) as SVGGraphicsElement

	svg.setAttribute('width', +svg.getAttribute('width')! + '')
	svg.setAttribute('height', +svg.getAttribute('height')! + '')

	const fileReader = new FileReader()
	const imgs = Array.from(clone.querySelectorAll('image')) as SVGImageElement[]

	for (const img of imgs) {
		const src = img.getAttribute('xlink:href')
		if (src) {
			if (!src.startsWith('data:')) {
				const blob = await (await fetch(src)).blob()
				const base64 = await new Promise<string>((resolve, reject) => {
					fileReader.onload = () => resolve(fileReader.result as string)
					fileReader.onerror = () => reject(fileReader.error)
					fileReader.readAsDataURL(blob)
				})
				img.setAttribute('xlink:href', base64)
			}
		}
	}

	const out = new XMLSerializer()
		.serializeToString(clone)
		.replaceAll('&#10;      ', '')
		.replaceAll(/((\s|")[0-9]*\.[0-9]{2})([0-9]*)(\b|"|\))/g, '$1')

	return out
}

function updateGeneratedImage(editor: Editor, shapeId: TLShapeId, url: string | null) {
	const shape = editor.getShape<LiveImageShape>(shapeId)!

	if (!url) {
		url = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
	}

	editor.updateShape({
		id: shape.id,
		type: shape.type,
		props: {
			...shape.props,
			src: url,
		},
	})

	// const id = AssetRecordType.createId(shape.id.split(':')[1])

	// const asset = editor.getAsset(id)

	// if (!asset) {
	// 	editor.createAssets([
	// 		AssetRecordType.create({
	// 			id,
	// 			type: 'image',
	// 			props: {
	// 				name: shape.props.name,
	// 				w: shape.props.w,
	// 				h: shape.props.h,
	// 				src: url,
	// 				isAnimated: false,
	// 				mimeType: 'image/jpeg',
	// 			},
	// 		}),
	// 	])
	// } else {
	// 	editor.updateAssets([
	// 		{
	// 			...asset,
	// 			type: 'image',
	// 			props: {
	// 				...asset.props,
	// 				w: shape.props.w,
	// 				h: shape.props.h,
	// 				src: url,
	// 			},
	// 		},
	// 	])
	// }
}

function getShapesTouching(shapeId: TLShapeId, editor: Editor) {
	const shapeIdsOnPage = editor.getCurrentPageShapeIds()
	const shapesTouching: TLShape[] = []
	const targetBounds = editor.getShapePageBounds(shapeId)
	if (!targetBounds) return shapesTouching
	for (const id of [...shapeIdsOnPage]) {
		if (id === shapeId) continue
		const bounds = editor.getShapePageBounds(id)!
		if (bounds.collides(targetBounds)) {
			shapesTouching.push(editor.getShape(id)!)
		}
	}
	return shapesTouching
}

function downloadDataURLAsFile(dataUrl: string, filename: string) {
	const link = document.createElement('a')
	link.href = dataUrl
	link.download = filename
	link.click()
}
