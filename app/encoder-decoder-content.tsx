"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { decode, encode } from "./encoding"
import { EmojiSelector } from "@/components/emoji-selector"
import { ALPHABET_LIST, EMOJI_LIST } from "./emoji"

export function Base64EncoderDecoderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") || "encode"
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [errorText, setErrorText] = useState("")
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(false)
  
  // State עבור בחירת אימוג'י מוגדר מראש
  const [selectedEmoji, setSelectedEmoji] = useState("")
  // State עבור הזנה ידנית – בתיבה זו יהיה תו אחד בלבד
  const [customInput, setCustomInput] = useState("")
  // מצב שמציין אם להשתמש בהזנה ידנית (true) או במוגדר מראש (false)
  const [useCustom, setUseCustom] = useState(false)
  
  const copyButtonRef = useRef<HTMLButtonElement>(null)
  const [copyButtonTop, setCopyButtonTop] = useState<number>(0)
  
  const updateMode = (newMode: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("mode", newMode)
    router.replace(`?${params.toString()}`)
  }
  
  useEffect(() => {
    try {
      const emojiToUse = useCustom ? customInput : selectedEmoji
      const isEncoding = mode === "encode"
      let output = isEncoding ? encode(emojiToUse, inputText) : decode(inputText)
      if (!isEncoding) {
        output = output
          .replace(/\uFE0F/g, '')
          .replace(/[\x00-\x1F\x7F]/g, '')
      }
      setOutputText(output)
      setErrorText("")
    } catch (e) {
      setOutputText("")
      setErrorText(`Error ${mode === "encode" ? "encoding" : "decoding"}: Invalid input`)
    }
  }, [mode, selectedEmoji, customInput, useCustom, inputText])
  
  const handleModeToggle = (checked: boolean) => {
    updateMode(checked ? "encode" : "decode")
    setInputText("")
  }
  
  useEffect(() => {
    if (!searchParams.has("mode")) {
      updateMode("encode")
    }
  }, [searchParams, updateMode])
  
  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      setInputText(clipboardText)
    } catch (err) {
      console.error("Error reading clipboard:", err)
    }
  }
  
  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    let graphemes: string[]
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
      graphemes = Array.from(segmenter.segment(value), segment => segment.segment)
    } else {
      graphemes = Array.from(value)
    }
    if (graphemes.length > 1) {
      setCustomInput(graphemes[graphemes.length - 1])
    } else {
      setCustomInput(value)
    }
  }
  
  const toggleDisabled = mode === "decode"
  
  const getButtonClasses = (selected: boolean, disabled: boolean) => {
    if (disabled) {
      return "px-4 py-2 bg-gray-300 text-gray-500 border border-gray-300 rounded cursor-not-allowed"
    }
    return selected
      ? "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:scale-95 transition-transform"
      : "px-4 py-2 bg-white text-blue-500 border border-blue-500 rounded hover:bg-blue-100 active:scale-95 transition-transform"
  }
  
  const disabledAreaClasses = mode === "decode" ? "pointer-events-none opacity-50" : ""
  
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      setCopySuccess(true)
      setCopyError(false)
      setTimeout(() => {
        setCopySuccess(false)
      }, 2000)
    } catch (err) {
      console.error("Error copying text:", err)
      setCopyError(true)
      setCopySuccess(false)
      setTimeout(() => {
        setCopyError(false)
      }, 2000)
    }
  }
  
  useEffect(() => {
    if (copyButtonRef.current) {
      const rect = copyButtonRef.current.getBoundingClientRect()
      setCopyButtonTop(rect.top + rect.height / 2)
    }
  }, [copySuccess, copyError])
  
  return (
    <CardContent className="space-y-4">
      <p>
         כלי זה יכול לך לקודד הודעה נסתרת לאימוג'י או אות אלפבית.
      </p>
      <div className="flex items-center justify-center space-x-2">
        <Label htmlFor="mode-toggle">Decode</Label>
        <Switch id="mode-toggle" checked={mode === "encode"} onCheckedChange={handleModeToggle} />
        <Label htmlFor="mode-toggle">Encode</Label>
      </div>
      <div className="flex flex-col">
        <Textarea
          placeholder={mode === "encode" ? "הזן טקסט להצפנה" : "הדבק טקסט לפיענוח"}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="min-h-[100px]"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handlePasteFromClipboard}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:scale-95 transition-transform"
          >
            הדבק מהלוח
          </button>
        </div>
      </div>
      <div className="flex space-x-4">
        <Button
          onClick={() => setUseCustom(false)}
          disabled={toggleDisabled}
          className={getButtonClasses(!useCustom, toggleDisabled)}
        >
          בחירה מוגדרת מראש
        </Button>
        <Button
          onClick={() => setUseCustom(true)}
          disabled={toggleDisabled}
          className={getButtonClasses(useCustom, toggleDisabled)}
        >
          הזנה ידנית
        </Button>
      </div>
      <div className={`flex flex-col ${disabledAreaClasses}`}>
        {useCustom ? (
          <div className="flex flex-col">
            <Label className="font-bold text-sm">הזן תו (תו אחד בלבד):</Label>
            <input
              type="text"
              placeholder="הזן תו"
              value={customInput}
              onChange={handleCustomInputChange}
              disabled={mode === "decode"}
              className={`border rounded p-2 ${mode === "encode" ? "bg-white" : "bg-gray-200"}`}
            />
          </div>
        ) : (
          <>
            <div className="font-bold text-sm">בחר אימוג'י</div>
            <EmojiSelector
              onEmojiSelect={setSelectedEmoji}
              selectedEmoji={selectedEmoji}
              emojiList={EMOJI_LIST}
              disabled={mode === "decode"}
            />
            <div className="font-bold text-sm">או בחר אות/תו</div>
            <EmojiSelector
              onEmojiSelect={setSelectedEmoji}
              selectedEmoji={selectedEmoji}
              emojiList={ALPHABET_LIST}
              disabled={mode === "decode"}
            />
          </>
        )}
      </div>
      <Textarea
        placeholder={mode === "encode" ? "פלט מוצפן" : "פלט מפוענח"}
        value={outputText}
        readOnly
        className="min-h-[100px]"
      />
      {/* אזור העתקת טקסט עם הודעת בועה */}
      <div className="relative flex items-center justify-end mt-2">
        <Button
          ref={copyButtonRef}
          onClick={handleCopyText}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:scale-95 transition-transform"
        >
          העתק טקסט
        </Button>
        <div
          className={`fixed left-1/2 transform -translate-x-1/2 px-3 py-0.5 border rounded-sm transition-opacity duration-500 ${
            copySuccess
              ? "border-green-500 bg-green-100 text-green-600 opacity-100"
              : copyError
              ? "border-red-500 bg-red-100 text-red-600 opacity-100"
              : "opacity-0"
          }`}
          style={{ top: copyButtonTop - 10 }}
        >
          {copySuccess ? "הטקסט הועתק" : copyError ? "הטקסט לא הועתק" : ""}
        </div>
      </div>
      {errorText && <div className="text-red-500 text-center">{errorText}</div>}
    </CardContent>
  )
}
