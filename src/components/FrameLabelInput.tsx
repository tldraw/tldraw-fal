import { TLShapeId, stopEventPropagation, useEditor, useIsEditing } from '@tldraw/editor'
import { forwardRef, useCallback } from 'react'

export const FrameLabelInput = forwardRef<
	HTMLInputElement,
	{
		id: TLShapeId;
		showOnlyIfEditing?: boolean;
	} & ({
			 type: 'number',
			 value: number,
			 onValueChange?: (value: number) => void,
			 min?: number,
			 max?: number,
			 step?: number,
		 } | {
			 type: 'text',
			 value: string,
			 placeholder?: string,
			 onValueChange?: (value: string) => void,
		 })
>(function FrameLabelInput(props, ref) {
	const {id, type, value, showOnlyIfEditing} = props

	const editor = useEditor()
	const isEditing = useIsEditing(id)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
				// need to prevent the enter keydown making it's way up to the Idle state
				// and sending us back into edit mode
				stopEventPropagation(e)
				e.currentTarget.blur()
				editor.setEditingShape(null)
			}
		},
		[editor]
	)

	const tryUpdateValue = useCallback(
		(wantedValue: string) => {
			switch (props.type) {
				case 'number':
					const numberValue = parseFloat(wantedValue)
					if (isNaN(numberValue)) return
					props.onValueChange?.(numberValue)
					break;
				case 'text':
					props.onValueChange?.(wantedValue)
					break;
				default:
					throw new Error(`Unexpected value type: ${typeof wantedValue}`);
			}
		},
		[props.type]
	)

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			tryUpdateValue(e.currentTarget.value.trim())
		},
		[id, editor]
	)

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			tryUpdateValue(e.currentTarget.value) // do not trim, that will be done on blur
		},
		[id, editor]
	)

	let valueToDisplay: string;
	switch (props.type) {
		case 'number':
			valueToDisplay = props.value.toFixed(2);
			break;
		case 'text':
			valueToDisplay = defaultEmptyAs(props.value, props.placeholder ?? '');
			break;
		default:
			throw new Error(`Unexpected value type: ${typeof value}`);
	}

	const showInput = !showOnlyIfEditing || isEditing

	return (
		<div className={`tl-frame-label ${showInput ? 'tl-frame-label__editing' : ''}`}>
			<input
				// using search to make lastpass ignore it 😅
				className="tl-frame-name-input search"
				type={type}
				ref={ref}
				style={{display: showInput ? undefined : 'none'}}
				value={value}
				autoFocus={showOnlyIfEditing}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				onChange={handleChange}
				onPointerDown={stopEventPropagation}
				min={props.type === 'number' ? props.min : undefined}
				max={props.type === 'number' ? props.max : undefined}
				step={props.type === 'number' ? props.step : undefined}
			/>
			{valueToDisplay + String.fromCharCode(8203)}
		</div>
	)
})

export function defaultEmptyAs(str: string, dflt: string) {
	if (str.match(/^\s*$/)) {
		return dflt
	}
	return str
}
