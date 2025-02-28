"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { decode, encode } from "./encoding"
import { EmojiSelector } from "@/components/emoji-selector"
import { ALPHABET_LIST, EMOJI_LIST } from "./emoji"
import { Button } from "@/components/ui/button";

export function Base64EncoderDecoderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") || "encode"

  const [inputText, setInputText] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState("")
  const [outputText, setOutputText] = useState("")
  const [errorText, setErrorText] = useState("")

  const updateMode = (newMode: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("mode", newMode)
    router.replace(`?${params.toString()}`)
  }

  useEffect(() => {
    try {
      const isEncoding = mode === "encode"
      const output = isEncoding ? encode(selectedEmoji, inputText) : decode(inputText)
      setOutputText(output)
      setErrorText("")
    } catch (e) {
      setOutputText("")
      setErrorText(`Error ${mode === "encode" ? "encoding" : "decoding"}: Invalid input`)
    }
  }, [mode, selectedEmoji, inputText])

  const handleModeToggle = (checked: boolean) => {
    updateMode(checked ? "encode" : "decode")
    setInputText("") // ניקוי הטקסט בעת החלפת מצב
  }

  useEffect(() => {
    if (!searchParams.has("mode")) {
      updateMode("encode")
    }
  }, [searchParams, updateMode])

  const isEncoding = mode === "encode"

  // פונקציה לקריאת הטקסט מהלוח
  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      setInputText(clipboardText)
    } catch (err) {
      console.error("Error reading clipboard:", err)
    }
  }

  return (
    <CardContent className="space-y-4">
      <p>
        כלי זה מאפשר לך לקודד הודעה נסתרת לאימוג'י או אות אלפבית. אַתָה
        יכול להעתיק ולהדביק טקסט עם הודעה נסתרת כדי לפענח את ההודעה.
      </p>
      <div className="flex items-center justify-center space-x-2">
        <Label htmlFor="mode-toggle">Decode</Label>
        <Switch id="mode-toggle" checked={isEncoding} onCheckedChange={handleModeToggle} />
        <Label htmlFor="mode-toggle">Encode</Label>
      </div>
      {/* עטיפת שדה הטקסט עם הכפתור שממוקם מתחתיו, מיושר לימין */}
      <div className="flex flex-col">
        <Textarea
          placeholder={isEncoding ? "Enter text to encode" : "Paste an emoji to decode"}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="min-h-[100px]"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handlePasteFromClipboard}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            הדבק מהלוח
          </button>
        </div>
      </div>
      <div className="font-bold text-sm">בחר אימוג'י</div>
      <EmojiSelector
        onEmojiSelect={setSelectedEmoji}
        selectedEmoji={selectedEmoji}
        emojiList={EMOJI_LIST}
        disabled={!isEncoding}
      />
      <div className="font-bold text-sm">או שאתה יכול לבחור אות רגילה או תו</div>
      <EmojiSelector
        onEmojiSelect={setSelectedEmoji}
        selectedEmoji={selectedEmoji}
        emojiList={ALPHABET_LIST}
        disabled={!isEncoding}
      />
      <Textarea
        placeholder={`${isEncoding ? "Encoded" : "Decoded"} output`}
        value={outputText}
        readOnly
        className="min-h-[100px]"
      />
            <div className="flex justify-end mt-2">
  <Button
    onClick={() => {
      navigator.clipboard.writeText(outputText);
    }}
    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
  >
    העתק טקסט
  </Button>
</div>

      {errorText && <div className="text-red-500 text-center">{errorText}</div>}
    </CardContent>
  )
}
