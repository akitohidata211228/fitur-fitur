import { sendText, textOnlyMessage } from '#helper'
import axios from 'axios'

/**
 * @param {import('../../system/types/plugin').HandlerParams} params
 */
async function handler({ sock, m, jid, text, command, prefix }) {
    if (!text) {
        return await sendText(sock, jid,
            `👲 *Canvas Ustadz*\n\n` +
            `Masukkan teks untuk dijadikan quote.\n\n` +
            `Contoh: *${prefix || ''}${command}* Jangan lupa bersyukur`,
            m
        )
    }

    await sock.sendMessage(m.chatId, { react: { text: '🕕', key: m.key } })

    try {
        const url = `https://api.cuki.biz.id/api/canvas/ustadz?apikey=cuki-x&text=${encodeURIComponent(text)}`
        const { data } = await axios.get(url)

        const imageUrl = data?.results?.url
        if (!imageUrl) throw new Error('URL gambar tidak ditemukan dari API')

        await sock.sendMessage(jid, {
            image: { url: imageUrl },
            caption: `👲 *${text}*`
        }, { quoted: m })

        await sock.sendMessage(m.chatId, { react: { text: '✅', key: m.key } })

    } catch (err) {
        console.error('[Canvas Ustadz]', err.message)
        await sock.sendMessage(m.chatId, { react: { text: '❌', key: m.key } })
        await sendText(sock, jid,
            `❌ *Gagal buat canvas ustadz*\n${err.message}`, m)
    }
}

handler.pluginName  = 'canvas ustadz'
handler.description = 'Buat quote bergaya ustadz dari teks yang kamu kirim.\n\nContoh:\nustadz Jangan lupa sholat'
handler.command     = ['ustadz', 'ustad', 'quoteustadz']
handler.category    = ['canvas']

handler.meta = {
    fileName: 'ustadz.js',
    version:  '1',
    author:   'converted',
    note:     'canvas ustadz via api.cuki.biz.id'
}

export default handler