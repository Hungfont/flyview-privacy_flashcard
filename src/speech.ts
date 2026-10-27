// Pronunciation via the browser's built-in text-to-speech (no network, no cost).
let voice: SpeechSynthesisVoice | undefined
let zhVoice: SpeechSynthesisVoice | undefined

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
  voice = voices.find((v) => v.lang === 'en-US' && /google|natural|samantha/i.test(v.name)) ?? voices.find((v) => v.lang === 'en-US') ?? voices[0]
  const zh = speechSynthesis.getVoices().filter((v) => /^zh|^cmn/i.test(v.lang))
  zhVoice = zh.find((v) => /zh-CN|cmn-Hans/i.test(v.lang)) ?? zh[0]
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice()
  speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

export function speak(text: string, rate = 0.9, lang: 'en' | 'zh' = 'en') {
  if (typeof speechSynthesis === 'undefined' || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'zh' ? 'zh-CN' : 'en-US'
  u.rate = rate
  const v = lang === 'zh' ? zhVoice : voice
  if (v) u.voice = v
  speechSynthesis.speak(u)
}
