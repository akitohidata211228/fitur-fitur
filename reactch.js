import { sendText, textOnlyMessage } from '#helper'
import { userManager } from '#helper'
import axios from 'axios'

/**
 * ⚡ WhatsApp Channel Reactor
 * Converted to Angelina base by: angelina
 * Original by: Omegatech
 *
 * Cara pakai:
 *   reactch <link> <emoji1,emoji2>
 *
 * Contoh:
 *   reactch https://whatsapp.com/channel/xxx/585 😭,🔥
 *   reactch https://whatsapp.com/channel/xxx/585 🔥
 *
 * @param {import('../../system/types/plugin').HandlerParams} params
 */

// ── JWT List (prioritas urutan, auto fallback jika error) ─────────────────────
const JWT_LIST = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NTZmMzhjOTllNGEzOTVlOWM0ZTc3NSIsImlhdCI6MTc3NjQ0ODg1OCwiZXhwIjoxNzc3MDUzNjU4fQ.JiKqtKv4cMDJYCi_Ua8LxFKrfciRXVV736mo_Rtq3U8',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Y2M0MTI5Nzk2ZDk0OGZiYjAxY2M2OSIsImlhdCI6MTc3NjQ2MTMwOCwiZXhwIjoxNzc3MDY2MTA4fQ.j8NfQcgeuzJRd2gsUdVefSuLIEaIlhAmnsjPckjN9Nc',
]

const BACKEND = 'https://back.asitha.top/api'

/**
 * Coba kirim reaction dengan satu JWT.
 * Throws jika gagal supaya bisa di-catch caller untuk fallback.
 */
async function tryReact(userJwt, postLink, emojis) {
  // Step 1: Ambil Recaptcha Token
  const { data: captchaData } = await axios.get('https://omegatech-api.dixonomega.tech/api/tools/recaptcha-v3', {
    params: {
      sitekey:        '6LemKk8sAAAAAH5PB3f1EspbMlXjtwv5C8tiMHSm',
      url:            'https://back.asitha.top/api',
      use_enterprise: 'false'
    }
  })

  if (!captchaData?.success || !captchaData?.token) {
    throw new Error('Recaptcha bypass gagal')
  }

  // Step 2: Ambil Temp API Key
  const { data: tempKeyData } = await axios.post(
    `${BACKEND}/user/get-temp-token`,
    { recaptcha_token: captchaData.token },
    { headers: { Authorization: `Bearer ${userJwt}`, 'Content-Type': 'application/json' } }
  )

  if (!tempKeyData?.token) {
    throw new Error('Gagal ambil temp API key')
  }

  // Step 3: Kirim Reaction
  await axios.post(
    `${BACKEND}/channel/react-to-post?apiKey=${tempKeyData.token}`,
    { post_link: postLink, reacts: emojis.join(',') },
    { headers: { Authorization: `Bearer ${userJwt}`, 'Content-Type': 'application/json' } }
  )
}

async function handler({ sock, m, text, jid }) {
  if (!textOnlyMessage(m)) return

  // owner only
  if (!userManager.trustedJids.has(m.senderId)) {
    return sendText(sock, jid, '⛔ owner only!', m)
  }

  if (!text) return sendText(sock, jid, helpText(), m)

  // ── Parse input ───────────────────────────────────────────────────────────
  const parts     = text.trim().split(/\s+/)
  const postLink  = parts[0]
  const reactsRaw = parts.slice(1).join(' ')

  // validasi link
  if (!postLink.includes('whatsapp.com/channel/')) {
    return sendText(sock, jid, '❌ Link channel WhatsApp tidak valid.', m)
  }

  // validasi emoji
  if (!reactsRaw) {
    return sendText(sock, jid,
      '❌ Emoji tidak boleh kosong.\n\nContoh:\nreactch https://whatsapp.com/channel/xxx/585 🔥,😭', m)
  }

  const emojis = reactsRaw.split(',').map(e => e.trim()).filter(Boolean)
  if (emojis.length > 4) {
    return sendText(sock, jid, '❌ Maksimal 4 emoji sekaligus.', m)
  }

  // loading react
  await sock.sendMessage(m.chatId, { react: { text: '🕒', key: m.key } })

  // ── Coba JWT satu per satu (fallback otomatis) ────────────────────────────
  let lastError = null

  for (let i = 0; i < JWT_LIST.length; i++) {
    try {
      await tryReact(JWT_LIST[i], postLink, emojis)

      // sukses
      await sock.sendMessage(m.chatId, { react: { text: '✅', key: m.key } })
      return sendText(sock, jid,
        `✅ *Reaction berhasil dikirim!*\n\n` +
        `🔗 Post  : ${postLink}\n` +
        `${emojis[0]} Emoji : ${emojis.join(', ')}`, m)

    } catch (e) {
      lastError = e
      console.warn(`[reactch] JWT ke-${i + 1} gagal: ${e.message}`)
      // lanjut ke JWT berikutnya
    }
  }

  // semua JWT gagal
  await sock.sendMessage(m.chatId, { react: { text: '❌', key: m.key } })
  const errMsg = lastError?.response?.data?.message || lastError?.message || 'Unknown error'
  return sendText(sock, jid,
    `❌ *Gagal kirim reaction*\n\nSemua JWT sudah dicoba.\n${errMsg}`, m)
}

function helpText() {
  return (
    `⚡ *WhatsApp Channel Reactor*\n\n` +
    `📖 *Cara pakai:*\n` +
    `• *reactch <link> <emoji>*\n` +
    `• *reactch <link> <emoji1,emoji2>* → max 4 emoji\n\n` +
    `📌 *Contoh:*\n` +
    `reactch https://whatsapp.com/channel/xxx/585 🔥\n` +
    `reactch https://whatsapp.com/channel/xxx/585 🔥,😭,❤️\n\n` +
    `💡 *Cara ambil link post:*\n` +
    `Tekan & tahan post di channel → Salin tautan`
  )
}

handler.pluginName  = 'react channel'
handler.description = 'React ke post channel WhatsApp via Omegatech API. Owner only. Max 4 emoji.'
handler.command     = ['reactch', 'rch']
handler.category    = ['tools']

handler.config = {
  bypassPrefix: false,
}

handler.meta = {
  fileName: 'reactch.js',
  version:  '3',
  author:   'hidata',
  note:     'dual JWT fallback — reactch <link> <emoji1,emoji2>'
}

export default handler