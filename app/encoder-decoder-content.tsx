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

// פונקציות עזר להצפנה/פענוח באמצעות Web Crypto API
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = ""
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary_string = atob(base64)
  const len = binary_string.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes
}

async function encryptWithPassword(plainText: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const enc = new TextEncoder()
  const passwordBytes = enc.encode(password)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 250000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plainTextBytes = enc.encode(plainText)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    plainTextBytes
  )
  const saltB64 = arrayBufferToBase64(salt)
  const ivB64 = arrayBufferToBase64(iv)
  const ciphertextB64 = arrayBufferToBase64(new Uint8Array(ciphertextBuffer))
  return `${saltB64}:${ivB64}:${ciphertextB64}`
}

async function decryptWithPassword(encryptedData: string, password: string): Promise<string> {
  const parts = encryptedData.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format")
  }
  const [saltB64, ivB64, ciphertextB64] = parts
  const salt = base64ToArrayBuffer(saltB64)
  const iv = base64ToArrayBuffer(ivB64)
  const ciphertext = base64ToArrayBuffer(ciphertextB64)
  const enc = new TextEncoder()
  const passwordBytes = enc.encode(password)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 250000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  )
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    )
    const dec = new TextDecoder()
    return dec.decode(decryptedBuffer)
  } catch (e) {
    throw new Error("Decryption failed")
  }
}

export function Base64EncoderDecoderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") || "encode"

  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [errorText, setErrorText] = useState("")
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(false)

  const [selectedEmoji, setSelectedEmoji] = useState("")
  const [customInput, setCustomInput] = useState("")
  const [useCustom, setUseCustom] = useState(false)

  const [usePasswordEncryption, setUsePasswordEncryption] = useState(false)
  const [password, setPassword] = useState("")
  const [decryptedResult, setDecryptedResult] = useState("")
  const [requiresPassword, setRequiresPassword] = useState(false)

  // מד חוזק סיסמה מבוסס zxcvbn (ייבוא דינמי)
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string }>({
    score: 0,
    feedback: "",
  })

  const copyButtonRef = useRef<HTMLButtonElement>(null)
  const [copyButtonTop, setCopyButtonTop] = useState<number>(0)

  const updateMode = (newMode: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("mode", newMode)
    router.replace(`?${params.toString()}`)
  }

  useEffect(() => {
    const doEncryptionDecryption = async () => {
      try {
        const emojiToUse = useCustom ? customInput : selectedEmoji
        const isEncoding = mode === "encode"
        if (isEncoding && usePasswordEncryption) {
          if (!password) {
            setErrorText("יש להזין סיסמה")
            setOutputText("")
            return
          }
          const encrypted = await encryptWithPassword(inputText, password)
          const prefixed = "PW:" + encrypted
          const output = encode(emojiToUse, prefixed)
          setOutputText(output)
          setErrorText("")
        } else if (isEncoding && !usePasswordEncryption) {
          let output = encode(emojiToUse, inputText)
          setOutputText(output)
          setErrorText("")
        } else {
          let decoded = decode(inputText)
          decoded = decoded.replace(/\uFE0F/g, "").replace(/[\x00-\x1F\x7F]/g, "")
          if (decoded.startsWith("PW:")) {
            setRequiresPassword(true)
            setOutputText("")
          } else {
            setRequiresPassword(false)
            setOutputText(decoded)
          }
          setErrorText("")
        }
      } catch (e) {
        setOutputText("")
        setErrorText(`Error ${mode === "encode" ? "encoding" : "decoding"}: Invalid input`)
      }
    }
    doEncryptionDecryption()
  }, [mode, selectedEmoji, customInput, useCustom, inputText, usePasswordEncryption, password])

  useEffect(() => {
    if (!searchParams.has("mode")) {
      updateMode("encode")
    }
  }, [searchParams])

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
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error("Error copying text:", err)
      setCopyError(true)
      setCopySuccess(false)
      setTimeout(() => setCopyError(false), 2000)
    }
  }

  useEffect(() => {
    if (copyButtonRef.current) {
      const rect = copyButtonRef.current.getBoundingClientRect()
      setCopyButtonTop(rect.top + rect.height / 2)
    }
  }, [copySuccess, copyError])

  const handleDecryptWithPassword = async () => {
    try {
      if (!password) {
        setErrorText("יש להזין סיסמה לפיענוח")
        setDecryptedResult("")
        return
      }
      const decoded = decode(inputText).replace(/\uFE0F/g, "").replace(/[\x00-\x1F\x7F]/g, "")
      const encryptedPart = decoded.slice(3)
      const originalText = await decryptWithPassword(encryptedPart, password)
      if (!originalText) {
        setErrorText("סיסמה שגויה")
        setDecryptedResult("")
      } else {
        setErrorText("")
        setDecryptedResult(originalText)
      }
    } catch (e) {
      setErrorText("סיסמה שגויה או טקסט לא תקין")
      setDecryptedResult("")
    }
  }

  // עדכון חוזק הסיסמה באמצעות dynamic import של zxcvbn
  useEffect(() => {
    (async () => {
      const { default: zxcvbnDynamic } = await import("zxcvbn")
      const result = zxcvbnDynamic(password)
      let feedback = ""
      switch (result.score) {
        case 0:
          feedback = "חלשה מאוד"
          break
        case 1:
          feedback = "חלשה"
          break
        case 2:
          feedback = "מתונה"
          break
        case 3:
          feedback = "טובה"
          break
        case 4:
          feedback = "חזקה מאוד"
          break
        default:
          feedback = "לא ידוע"
          break
      }
      setPasswordStrength({ score: result.score, feedback })
    })()
  }, [password])

  const handleModeToggle = (checked: boolean) => {
    updateMode(checked ? "encode" : "decode")
    setInputText("")
    if (!checked) {
      setDecryptedResult("")
      setRequiresPassword(false)
    }
  }

  return (
    <CardContent className="space-y-4">
      <p>
        כלי זה מאפשר לקודד הודעה תוך שימוש באימוג'י או אות, וכעת ניתן לבחור גם להצפנה עם סיסמה.
      </p>
      <div className="flex items-center justify-center space-x-2">
        <Label htmlFor="mode-toggle">Decode</Label>
        <Switch id="mode-toggle" checked={mode === "encode"} onCheckedChange={handleModeToggle} />
        <Label htmlFor="mode-toggle">Encode</Label>
      </div>
      {mode === "encode" && (
        <div className="flex items-center justify-center mt-4">
          <Label htmlFor="password-toggle" className="mr-2">הצפנה עם סיסמה</Label>
          <Switch
            id="password-toggle"
            checked={usePasswordEncryption}
            onCheckedChange={(checked) => {
              setUsePasswordEncryption(checked)
              setPassword("")
              setDecryptedResult("")
            }}
          />
        </div>
      )}
      {mode === "encode" && usePasswordEncryption && (
        <div className="flex flex-col space-y-2">
          <Label className="font-bold text-sm">הזן סיסמה להצפנה:</Label>
          <input
            type="text"
            placeholder="הזן סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            className="border rounded p-2"
          />
          <div className="text-sm">
            עוצמת הסיסמה: {passwordStrength.feedback} (Score: {passwordStrength.score})
          </div>
        </div>
      )}
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
      {(mode === "encode" || (mode === "decode" && !requiresPassword)) && (
        <Textarea
          placeholder={mode === "encode" ? "פלט מוצפן" : "פלט מפוענח"}
          value={outputText}
          readOnly
          className="min-h-[100px]"
        />
      )}
      {mode === "decode" && requiresPassword && (
        <div className="flex flex-col space-y-2">
          <Label className="font-bold text-sm">הזן סיסמה לפיענוח:</Label>
          <input
            type="text"
            placeholder="הזן סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            className="border rounded p-2"
          />
          <Button
            onClick={handleDecryptWithPassword}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:scale-95 transition-transform"
          >
            פענח טקסט
          </Button>
          <Textarea
            placeholder="תוצאת הפיענוח"
            value={decryptedResult}
            readOnly
            className={`min-h-[100px] ${decryptedResult ? "" : "bg-gray-200"}`}
          />
        </div>
      )}
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
