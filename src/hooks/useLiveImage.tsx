import { LiveImageShape } from '@/components/LiveImageShapeUtil'
import { blobToDataUri } from '@/utils/blob'
import * as fal from '@fal-ai/serverless-client'
import {
	AssetRecordType,
	Editor,
	TLShape,
	TLShapeId,
	getHashForObject,
	getSvgAsImage,
	rng,
	useEditor,
} from '@tldraw/tldraw'
import { createContext, useContext, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'

type LiveImageResult = { url: string }
type LiveImageRequest = {
	prompt: string
	image_url: string
	sync_mode: boolean
	strength: number
	seed: number
	enable_safety_checks: boolean
}
type LiveImageContextType = null | ((req: LiveImageRequest) => Promise<LiveImageResult>)
const LiveImageContext = createContext<LiveImageContextType>(null)

export function LiveImageProvider({
	children,
	appId,
	throttleTime = 0,
	timeoutTime = 5000,
}: {
	children: React.ReactNode
	appId: string
	throttleTime?: number
	timeoutTime?: number
}) {
	const [count, setCount] = useState(0)
	const [fetchImage, setFetchImage] = useState<{ current: LiveImageContextType }>({ current: null })

	useEffect(() => {
		const requestsById = new Map<
			string,
			{
				resolve: (result: LiveImageResult) => void
				reject: (err: unknown) => void
				timer: ReturnType<typeof setTimeout>
			}
		>()

		const { send, close } = fal.realtime.connect(appId, {
			connectionKey: 'fal-realtime-example',
			clientOnly: false,
			throttleInterval: throttleTime,
			onError: (error) => {
				console.error(error)
				// force re-connect
				setCount((count) => count + 1)
			},
			onResult: (result) => {
				if (result.images && result.images[0]) {
					const id = result.request_id
					const request = requestsById.get(id)
					if (request) {
						request.resolve(result.images[0])
					}
				}
			},
		})

		setFetchImage({
			current: (req) => {
				return new Promise((resolve, reject) => {
					const id = uuid()
					const timer = setTimeout(() => {
						requestsById.delete(id)
						reject(new Error('Timeout'))
					}, timeoutTime)
					requestsById.set(id, {
						resolve: (res) => {
							resolve(res)
							clearTimeout(timer)
						},
						reject: (err) => {
							reject(err)
							clearTimeout(timer)
						},
						timer,
					})
					send({ ...req, request_id: id })
				})
			},
		})

		return () => {
			for (const request of requestsById.values()) {
				request.reject(new Error('Connection closed'))
			}
			try {
				close()
			} catch (e) {
				// noop
			}
		}
	}, [appId, count, throttleTime, timeoutTime])

	return (
		<LiveImageContext.Provider value={fetchImage.current}>{children}</LiveImageContext.Provider>
	)
}

export function useLiveImage(
	shapeId: TLShapeId,
	{ throttleTime = 64 }: { throttleTime?: number } = {}
) {
	const editor = useEditor()
	const fetchImage = useContext(LiveImageContext)
	if (!fetchImage) throw new Error('Missing LiveImageProvider')

	useEffect(() => {
		let prevHash = ''
		let prevPrompt = ''
		let prevStrength = 0.65
		let prevSeed = 0

		let startedIteration = 0
		let finishedIteration = 0

		async function updateDrawing() {
			const shapes = getShapesTouching(shapeId, editor)
			const frame = editor.getShape<LiveImageShape>(shapeId)!

			const hash = getHashForObject([...shapes])
			const frameName = frame.props.name
			const strength = frame.props.strength
			const seed = frame.props.seed

			if (hash === prevHash
				&& frameName === prevPrompt
				&& strength === prevStrength
				&& seed === prevSeed
			) return

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
					updateImage(editor, frame.id, '')
					return
				}

				const image = await getSvgAsImage(svg, editor.environment.isSafari, {
					type: 'png',
					quality: 1,
					scale: 512 / frame.props.w,
				})
				// cancel if stale:
				if (iteration <= finishedIteration) return

				if (!image) {
					console.error('No image')
					updateImage(editor, frame.id, '')
					return
				}

				const prompt = frameName
					? frameName + ' hd award-winning impressive'
					: 'A random image that is safe for work and not surprising—something boring like a city or shoe watercolor'

				const imageDataUri = await blobToDataUri(image)

				// cancel if stale:
				if (iteration <= finishedIteration) return

				// downloadDataURLAsFile(imageDataUri, 'image.png')

				const random = rng(shapeId)

				const result = await fetchImage!({
					prompt,
					image_url: imageDataUri,
					sync_mode: true,
					strength: Math.min(1, Math.max(0, strength)),
					seed,
					enable_safety_checks: false,
				})
				// cancel if stale:
				if (iteration <= finishedIteration) return

				finishedIteration = iteration
				updateImage(editor, frame.id, result.url)
			} catch (e) {
				const isTimeout = e instanceof Error && e.message === 'Timeout'
				if (!isTimeout) {
					console.error(e)
				}

				// retry if this was the most recent request:
				if (iteration === startedIteration) {
					requestUpdate()
				}
			}
		}

		let timer: ReturnType<typeof setTimeout> | null = null
		function requestUpdate() {
			if (timer !== null) return
			timer = setTimeout(() => {
				timer = null
				updateDrawing()
			}, throttleTime)
		}

		editor.on('update-drawings' as any, requestUpdate)
		return () => {
			editor.off('update-drawings' as any, requestUpdate)
		}
	}, [editor, fetchImage, shapeId, throttleTime])
}

function updateImage(editor: Editor, shapeId: TLShapeId, url: string | null) {
	const shape = editor.getShape<LiveImageShape>(shapeId)!
	const id = AssetRecordType.createId(shape.id.split(':')[1])

	const asset = editor.getAsset(id)

	if (!asset) {
		editor.createAssets([
			AssetRecordType.create({
				id,
				type: 'image',
				props: {
					name: shape.props.name,
					w: shape.props.w,
					h: shape.props.h,
					src: url,
					isAnimated: false,
					mimeType: 'image/jpeg',
				},
			}),
		])
	} else {
		editor.updateAssets([
			{
				...asset,
				type: 'image',
				props: {
					...asset.props,
					w: shape.props.w,
					h: shape.props.h,
					src: url,
				},
			},
		])
	}
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
