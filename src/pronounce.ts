// Pronunciation check: the browser's speech recognizer listens to the learner, we compare what it heard
// with the target word, then build coaching tips (stress, ending sounds, sounds Vietnamese speakers find hard).

type Alternative = { transcript: string; confidence: number }
type RecognitionEvent = { results: ArrayLike<ArrayLike<Alternative> & { isFinal: boolean }> }
type RecognitionErrorEvent = { error: string }
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  processLocally?: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = (new () => Recognition) & {
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>
}

const Ctor = (globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
const SR = Ctor.SpeechRecognition ?? Ctor.webkitSpeechRecognition

export const canRecognize = !!SR
export const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export type Lang = 'en' | 'zh'
const LOCALE: Record<Lang, string> = { en: 'en-US', zh: 'zh-CN' }

// Prefer on-device recognition (newer Chrome) so audio stays on this computer.
async function onDevice(lang: Lang) {
  if (!SR?.available) return false
  const opts = { langs: [LOCALE[lang]], processLocally: true }
  try {
    const status = await SR.available(opts)
    if (status === 'available') return true
    if (status === 'downloadable') void SR.install?.(opts).catch(() => {}) // ready for next time
  } catch { /* not supported */ }
  return false
}

export type Heard = { alternatives: string[]; local: boolean }

export const ERRORS: Record<string, string> = {
  'not-allowed': 'Chưa được phép dùng micro. Hãy cho phép micro trong thanh địa chỉ của trình duyệt.',
  'service-not-allowed': 'Trình duyệt không cho phép nhận dạng giọng nói.',
  'no-speech': 'Không nghe thấy gì. Hãy nói to, rõ và gần micro hơn.',
  'audio-capture': 'Không tìm thấy micro.',
  network: 'Không kết nối được dịch vụ nhận dạng giọng nói (cần mạng).',
  'language-not-supported': 'Trình duyệt không hỗ trợ nhận dạng ngôn ngữ này.',
}

export async function listen(lang: Lang, onStart: (stop: () => void) => void): Promise<Heard> {
  if (!SR) throw new Error('unsupported')
  const local = await onDevice(lang)
  return new Promise((resolve, reject) => {
    const r = new SR()
    r.lang = LOCALE[lang]
    r.interimResults = false
    r.maxAlternatives = 5
    r.continuous = false
    if (local) r.processLocally = true
    let alternatives: string[] = []
    let error = ''
    r.onresult = (e) => {
      const res = e.results[0]
      alternatives = Array.from({ length: res.length }, (_, i) => res[i].transcript)
    }
    r.onerror = (e) => { error = e.error }
    r.onend = () => (error && error !== 'aborted' && error !== 'no-speech' ? reject(new Error(error)) : resolve({ alternatives, local }))
    r.start()
    onStart(() => r.stop())
  })
}

// ---------- scoring ----------
function lev(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp
}

const norm = (s: string, lang: Lang) =>
  lang === 'zh'
    ? s.replace(/[^\p{Script=Han}a-z0-9]/giu, '')
    : s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// A headword can hold variants: "skilfully/skillfully", "面包师；面包店".
export function targets(text: string, lang: Lang) {
  return text.split(/[/;；,，]/).map((t) => norm(t, lang)).filter(Boolean)
}

export type Result = {
  ok: boolean
  score: number // 0..1 similarity of the best alternative
  heard: string // best guess of what was said
  target: string // closest target variant
  marks: boolean[] // per character of `target`: pronounced (recognized) correctly?
  endingMissed: boolean
}

export function judge(alternatives: string[], text: string, lang: Lang): Result {
  const tgts = targets(text, lang)
  let best: Result | null = null
  for (const alt of alternatives) {
    const h = norm(alt, lang)
    for (const t of tgts) {
      // The recognizer may add filler ("the baker", "baker baker"): count the target found inside as correct.
      const found = lang === 'zh' ? h.includes(t) : ` ${h} `.includes(` ${t} `)
      const dp = lev(t, h)
      const score = found ? 1 : 1 - dp[t.length][h.length] / Math.max(t.length, h.length, 1)
      if (!best || score > best.score) best = { ok: found, score, heard: h, target: t, marks: [], endingMissed: false }
    }
  }
  if (!best) return { ok: false, score: 0, heard: '', target: tgts[0] ?? '', marks: [], endingMissed: false }
  best.marks = best.ok ? Array(best.target.length).fill(true) : align(best.target, best.heard)
  const firstBad = best.marks.indexOf(false)
  best.endingMissed = !best.ok && lang === 'en' && firstBad >= Math.ceil(best.target.length / 2)
  return best
}

// Walk back through the edit-distance table to find which target letters were matched.
function align(t: string, h: string) {
  const dp = lev(t, h)
  const marks = Array<boolean>(t.length).fill(false)
  let i = t.length
  let j = h.length
  while (i > 0 && j > 0) {
    if (t[i - 1] === h[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { marks[i - 1] = true; i--; j-- }
    else if (dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j-- }
    else if (dp[i][j] === dp[i - 1][j] + 1) i--
    else j--
  }
  return marks
}

// ---------- English coaching from the IPA ----------
export type Syllable = { text: string; stress: 0 | 1 | 2 }

export function cleanIpa(ipa: string) {
  return ipa.replace(/^\/|\/$/g, '').split('/')[0].replace(/ӕ/g, 'æ').replace(/ɡ/g, 'g').trim()
}

export function syllables(ipa: string): Syllable[] {
  const out: Syllable[] = []
  let cur: Syllable = { text: '', stress: 0 }
  const push = () => { if (cur.text) out.push(cur) }
  for (const ch of cleanIpa(ipa)) {
    if (ch === '.' || ch === ' ' || ch === 'ˈ' || ch === 'ˌ') {
      push()
      cur = { text: '', stress: ch === 'ˈ' ? 1 : ch === 'ˌ' ? 2 : 0 }
    } else cur.text += ch
  }
  push()
  return out
}

const SOUND_TIPS: [RegExp, string, string][] = [
  [/θ/, '/θ/ (th trong “think”)', 'Đặt đầu lưỡi giữa hai hàm răng rồi thổi hơi ra. Không đọc thành “t” hay “ph”.'],
  [/ð/, '/ð/ (th trong “this”)', 'Lưỡi đặt giữa hai răng như /θ/ nhưng rung cổ họng. Không đọc thành “đ” hay “d”.'],
  [/ʃ/, '/ʃ/ (sh)', 'Chu môi ra trước, lưỡi lùi vào trong, thổi hơi “sh”. Khác với “s” (môi dẹt).'],
  [/ʒ/, '/ʒ/ (như “measure”)', 'Khẩu hình giống /ʃ/ nhưng rung cổ họng.'],
  [/tʃ/, '/tʃ/ (ch)', 'Bật mạnh hơi “t-sh”, môi chu. Không đọc thành “ch” tiếng Việt (mềm hơn).'],
  [/dʒ/, '/dʒ/ (j)', 'Như /tʃ/ nhưng rung cổ họng: “d-zh”. Không đọc thành “gi” hay “z”.'],
  [/[ɹrɚɝ]/, '/r/', 'Cong đầu lưỡi lên và lùi vào trong, không chạm vòm miệng. Không đọc thành “z” hay “r” rung.'],
  [/æ/, '/æ/ (a bẹt)', 'Mở miệng rộng, kéo khóe môi sang hai bên: âm nằm giữa “a” và “e”.'],
  [/iː/, '/iː/ (i dài)', 'Kéo dài và căng môi như đang cười: “iii”. Khác /ɪ/ ngắn, lỏng.'],
  [/(?<![eaɔoə])ɪ(?!ə)/, '/ɪ/ (i ngắn)', 'Ngắn và thả lỏng, gần giữa “i” và “ê”.'],
  [/uː/, '/uː/ (u dài)', 'Tròn môi và kéo dài “uuu”.'],
  [/(?<![aoə])ʊ(?!ə)/, '/ʊ/ (u ngắn)', 'Ngắn, môi tròn nhẹ, không kéo dài.'],
  [/ʌ/, '/ʌ/', 'Âm ngắn giống “ă” tiếng Việt, miệng mở vừa.'],
  [/ɜː|ɝ/, '/ɜː/', 'Giống “ơ” kéo dài, môi không tròn.'],
  [/v/, '/v/', 'Răng trên chạm nhẹ môi dưới rồi rung. Đừng đọc thành “b” hay bỏ qua.'],
  [/z/, '/z/', 'Như “s” nhưng rung cổ họng (đặt tay lên cổ sẽ thấy rung).'],
  [/ŋ/, '/ŋ/ (ng)', 'Như “ng” tiếng Việt, nhưng ở cuối từ đừng thêm âm “g” bật ra.'],
]

const FINALS: Record<string, string> = {
  p: '/p/', b: '/b/', t: '/t/', d: '/d/', k: '/k/', g: '/g/', f: '/f/', v: '/v/', s: '/s/', z: '/z/',
  θ: '/θ/', ð: '/ð/', ʃ: '/ʃ/', ʒ: '/ʒ/', l: '/l/', m: '/m/', n: '/n/', ŋ: '/ŋ/',
}

export type Tip = { title: string; body: string }

export function englishTips(ipa: string, r: Result | null): Tip[] {
  const tips: Tip[] = []
  const syl = syllables(ipa)
  const body = syl.map((s) => s.text).join('')
  const stressed = syl.findIndex((s) => s.stress === 1)
  if (syl.length > 1 && stressed >= 0) {
    tips.push({
      title: `Trọng âm ở âm tiết thứ ${stressed + 1}`,
      body: 'Đọc âm tiết in đậm to hơn, dài hơn, cao giọng hơn; các âm tiết còn lại đọc nhẹ và nhanh. Tiếng Anh sai trọng âm thì người nghe rất khó hiểu.',
    })
  }
  const last = body.replace(/ː|ˑ|\u032C|\u0303|ʰ/g, '').match(/(tʃ|dʒ|.)$/)?.[1] ?? ''
  const final = last === 'tʃ' ? '/tʃ/' : last === 'dʒ' ? '/dʒ/' : FINALS[last]
  if (final) {
    tips.push({
      title: `Đọc rõ âm cuối ${final}`,
      body: r?.endingMissed
        ? 'Máy nghe đúng phần đầu nhưng sai phần cuối — có thể bạn đã nuốt âm cuối. Giữ khẩu hình đến hết từ và bật nhẹ âm cuối.'
        : 'Người Việt hay nuốt âm cuối. Giữ khẩu hình đến hết từ và bật nhẹ âm cuối.',
    })
  }
  else if (r?.endingMissed) {
    tips.push({ title: 'Đọc trọn phần cuối của từ', body: 'Máy nghe đúng phần đầu nhưng sai phần cuối. Đừng ngắt sớm, đọc hết âm tiết cuối rồi mới dừng.' })
  }
  const onset = body.match(/^[^aeiouæɑɒɔəɛɜɪʊʌɚɝ]{2,}/)?.[0]
  if (onset && !/^(tʃ|dʒ)$/.test(onset)) {
    tips.push({ title: `Cụm phụ âm đầu /${onset}/`, body: 'Đọc liền các phụ âm, không chèn “ơ” vào giữa (ví dụ “street” không phải “sơ-tơ-rít”).' })
  }
  for (const [re, title, text] of SOUND_TIPS) if (re.test(body)) tips.push({ title, body: text })
  return tips.slice(0, 5)
}

// ---------- Chinese coaching from the pinyin ----------
const TONE_MARKS: Record<string, number> = {}
for (const marks of ['āáǎà', 'ēéěè', 'īíǐì', 'ōóǒò', 'ūúǔù', 'ǖǘǚǜ']) [...marks].forEach((m, i) => { TONE_MARKS[m] = i + 1 })
const TONE_NAMES = ['', 'thanh 1 (ngang, cao)', 'thanh 2 (đi lên, như dấu sắc)', 'thanh 3 (xuống rồi lên, gần dấu hỏi)', 'thanh 4 (rơi mạnh, dứt khoát)']

export function tones(pinyin: string) {
  return [...pinyin.split(/[;；]/)[0]].map((c) => TONE_MARKS[c]).filter(Boolean)
}

export function chineseTips(pinyin: string): Tip[] {
  const first = pinyin.split(/[;；]/)[0]
  const tips: Tip[] = []
  const t = tones(first)
  if (t.length) {
    tips.push({
      title: `Thanh điệu: ${t.join(' → ')}`,
      body: [...new Set(t)].map((n) => TONE_NAMES[n]).join('; ') + '. Sai thanh là thành từ khác, hãy nghe mẫu chậm và bắt chước độ cao giọng.',
    })
  }
  const plain = first.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  // In pinyin j/q/x/z/c/r only appear as initials (or erhua r), so a plain substring test is enough.
  if (/zh|ch|sh|r/.test(plain))
    tips.push({ title: 'zh / ch / sh / r (âm uốn lưỡi)', body: 'Cong đầu lưỡi lên chạm sau lợi trên. ch = zh nhưng bật hơi mạnh; r gần “r” nhẹ, không rung.' })
  if (/[jqx]/.test(plain))
    tips.push({ title: 'j / q / x', body: 'Mặt lưỡi áp sát vòm, môi dẹt như cười. j ≈ “chi” nhẹ, q = j bật hơi, x ≈ “xi” mỏng.' })
  if (/[zc](?!h)/.test(plain))
    tips.push({ title: 'z / c', body: 'z ≈ “ch” đầu lưỡi (“ts” không bật hơi), c = “ts” bật hơi mạnh. Không đọc c thành “k”.' })
  if (/ü|ǖ|ǘ|ǚ|ǜ|[jqxy]u/.test(first.toLowerCase()))
    tips.push({ title: 'ü (yu / ju / qu / xu)', body: 'Đọc “i” rồi giữ lưỡi, tròn môi lại như “u”: âm giữa “uy” liền một hơi.' })
  return tips.slice(0, 4)
}
