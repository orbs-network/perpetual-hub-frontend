import * as React from "react"
import {
  NumericFormat,
  type NumberFormatValues,
  type NumericFormatProps,
  type SourceInfo,
} from "react-number-format"

import {
  Input,
  type InputFocusColor,
  type InputProps,
  type InputSize,
} from "./input"

export interface NumericInputProps
  extends Omit<
    NumericFormatProps<InputProps>,
    "size" | "customInput" | "inputSize" | "focusColor" | "startContent" | "endContent" | "wrapperClassName"
  > {
  size?: InputSize
  focusColor?: InputFocusColor
  startContent?: React.ReactNode
  endContent?: React.ReactNode
  wrapperClassName?: string
}

function parseNumericString(value: unknown) {
  if (value === undefined || value === null) return ""
  return String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
}

function parseFiniteNumber(value: unknown) {
  const numericString = parseNumericString(value)
  if (!numericString || numericString === "-" || numericString === ".") return undefined
  const number = Number(numericString)
  return Number.isFinite(number) ? number : undefined
}

function getDecimalPlaces(value: unknown) {
  const numericString = parseNumericString(value)
  const [, decimalPart = ""] = numericString.split(".")
  return decimalPart.length
}

function resolveWheelStep(step: NumericInputProps["step"], decimalScale?: number) {
  const stepNumber = parseFiniteNumber(step)
  if (stepNumber !== undefined && stepNumber > 0) return stepNumber
  if (Number.isFinite(decimalScale) && decimalScale !== undefined && decimalScale > 0) {
    return 10 ** -decimalScale
  }
  return 1
}

function formatWheelValue(value: number, decimalPlaces: number, fixedDecimalScale?: boolean) {
  const rounded = value.toFixed(decimalPlaces)
  if (fixedDecimalScale || decimalPlaces === 0) return rounded
  return rounded.replace(/\.?0+$/, "")
}

function allowsDecimalInput(decimalScale?: number) {
  return decimalScale === undefined || decimalScale > 0
}

function leadingDecimalValues(): NumberFormatValues {
  return {
    formattedValue: "0.",
    value: "0.",
    floatValue: 0,
  }
}

function leadingDecimalDigitValues(digit: string): NumberFormatValues {
  const value = `0.${digit}`
  return {
    formattedValue: value,
    value,
    floatValue: Number(value),
  }
}

function isDigitKey(key: string) {
  return /^[0-9]$/.test(key)
}

function eventInputValue(sourceInfo: SourceInfo) {
  const target = sourceInfo.event?.target
  return target instanceof HTMLInputElement ? target.value : undefined
}

function requestInputSelectionUpdate(callback: () => void) {
  callback()

  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback)
  }

  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(callback)
  }

  globalThis.setTimeout(callback, 0)
  globalThis.setTimeout(callback, 16)
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      allowNegative = false,
      className,
      decimalScale,
      disabled,
      endContent,
      fixedDecimalScale,
      focusColor,
      isAllowed,
      max,
      min,
      onKeyDown,
      onValueChange,
      onWheel,
      readOnly,
      size = "default",
      startContent,
      step,
      value,
      wrapperClassName,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const setInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof ref === "function") {
          ref(node)
          return
        }
        if (ref) {
          const refObject = ref as React.MutableRefObject<HTMLInputElement | null>
          refObject.current = node
        }
      },
      [ref],
    )

    const moveCaretToInputEnd = React.useCallback(() => {
      requestInputSelectionUpdate(() => {
        const input = inputRef.current
        if (!input) return
        const position = input.value.length
        input.setSelectionRange(position, position)
      })
    }, [])

    const handleValueChange = React.useCallback(
      (values: NumberFormatValues, sourceInfo: SourceInfo) => {
        if (!onValueChange) return

        const rawValue = eventInputValue(sourceInfo)
        if (
          allowsDecimalInput(decimalScale) &&
          (rawValue === "." || values.formattedValue === "." || values.value === ".")
        ) {
          const nextValues = leadingDecimalValues()
          if (isAllowed && !isAllowed(nextValues)) return
          onValueChange(nextValues, sourceInfo)
          moveCaretToInputEnd()
          return
        }

        onValueChange(values, sourceInfo)
      },
      [decimalScale, isAllowed, moveCaretToInputEnd, onValueChange],
    )

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event)
      if (
        event.defaultPrevented ||
        disabled ||
        readOnly ||
        !onValueChange ||
        !allowsDecimalInput(decimalScale)
      ) {
        return
      }

      const { selectionStart, selectionEnd, value: inputValue } = event.currentTarget
      if (
        isDigitKey(event.key) &&
        inputValue === "0." &&
        selectionStart !== null &&
        selectionEnd !== null &&
        selectionStart === selectionEnd &&
        selectionStart <= 1
      ) {
        const values = leadingDecimalDigitValues(event.key)
        if (isAllowed && !isAllowed(values)) return

        event.preventDefault()
        onValueChange(values, {
          event,
          source: "event" as SourceInfo["source"],
        } as SourceInfo)
        moveCaretToInputEnd()
        return
      }

      if (event.key !== ".") return

      const isEmpty = inputValue === ""
      const isReplacingEverything =
        selectionStart === 0 &&
        selectionEnd === inputValue.length &&
        inputValue.length > 0

      if (!isEmpty && !isReplacingEverything) return

      const values = leadingDecimalValues()
      if (isAllowed && !isAllowed(values)) return

      event.preventDefault()
      onValueChange(values, {
        event,
        source: "event" as SourceInfo["source"],
      } as SourceInfo)
      moveCaretToInputEnd()
    }

    const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
      onWheel?.(event)
      if (event.defaultPrevented) return
      if (
        disabled ||
        readOnly ||
        !onValueChange ||
        event.deltaY === 0 ||
        event.currentTarget !== event.currentTarget.ownerDocument.activeElement
      ) {
        return
      }

      event.preventDefault()

      const currentValue = parseFiniteNumber(value ?? event.currentTarget.value) ?? 0
      const stepValue = resolveWheelStep(step, decimalScale)
      const direction = event.deltaY < 0 ? 1 : -1
      const minValue = parseFiniteNumber(min) ?? (allowNegative ? undefined : 0)
      const maxValue = parseFiniteNumber(max)
      const decimalPlaces = Math.max(
        Number.isFinite(decimalScale) && decimalScale !== undefined ? decimalScale : 0,
        getDecimalPlaces(value ?? event.currentTarget.value),
        getDecimalPlaces(stepValue),
      )
      const scale = 10 ** decimalPlaces
      let nextValue = Math.round((currentValue + direction * stepValue) * scale) / scale

      if (minValue !== undefined && nextValue < minValue) nextValue = minValue
      if (maxValue !== undefined && nextValue > maxValue) nextValue = maxValue
      if (nextValue === currentValue) return

      const nextNumericString = formatWheelValue(
        nextValue,
        decimalPlaces,
        fixedDecimalScale,
      )
      const values: NumberFormatValues = {
        formattedValue: nextNumericString,
        value: nextNumericString,
        floatValue: nextValue,
      }
      if (isAllowed && !isAllowed(values)) return

      onValueChange(values, {
        event,
        source: "event" as SourceInfo["source"],
      })
    }

    return (
      <NumericFormat<InputProps>
        getInputRef={setInputRef}
        customInput={Input}
        thousandSeparator=","
        allowNegative={allowNegative}
        placeholder="0.00"
        inputSize={size}
        focusColor={focusColor}
        startContent={startContent}
        endContent={endContent}
        wrapperClassName={wrapperClassName}
        className={className}
        decimalScale={decimalScale}
        disabled={disabled}
        fixedDecimalScale={fixedDecimalScale}
        isAllowed={isAllowed}
        max={max}
        min={min}
        onKeyDown={handleKeyDown}
        onValueChange={handleValueChange}
        onWheel={handleWheel}
        readOnly={readOnly}
        step={step}
        value={value}
        {...props}
      />
    )
  }
)
NumericInput.displayName = "NumericInput"

export { NumericInput }
