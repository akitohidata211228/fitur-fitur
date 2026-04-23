import axios from 'axios'
import { sendText, textOnlyMessage } from '#helper'

/**
 * @param {import('../../system/types/plugin.js').HandlerParams} params
 */
async function handler({ sock, m, jid, text, command, prefix }) {
    if (!textOnlyMessage(m)) return

    if (!text) {
        return await sendText(sock, jid,
            `❌ Masukkan judul lagu!\nContoh: *${prefix || ''}${command}* swim chase atlantic`, m)
    }

    await sock.sendMessage(jid, { react: { text: '🕒', key: m.key } })

    try {
        // Search + get audio URL via API cuki (sama seperti playch)
        const api = `https://api.cuki.biz.id/api/search/playyt?apikey=cuki-x&query=${encodeURIComponent(text)}`
        const { data } = await axios.get(api)

        if (!data?.success || !data?.data?.download?.audio?.directLink) {
            throw new Error('Audio tidak ditemukan dari API')
        }

        const audioUrl = data.data.download.audio.directLink
        const title =
            data.data.download.metadata?.title ||
            data.data.video?.title ||
            'Unknown Title'

        // Download ke buffer
        const audioRes = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const audioBuffer = Buffer.from(audioRes.data)

        if (audioBuffer.length < 1000) {
            throw new Error(`File audio kosong (${audioBuffer.length} bytes)`)
        }

        // Kirim sebagai audio ke chat biasa
        await sock.sendMessage(jid, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        }, { quoted: m })

        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.error('[infolagu]', e.message)
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } })
        await sendText(sock, jid, `❌ Gagal mengambil audio\n${e.message}`, m)
    }
}

handler.pluginName = 'info lagu'
handler.description =
    'Cari dan kirim audio lagu dari YouTube.\n\n' +
    'Penggunaan:\n' +
    'infolagu swim chase atlantic\n' +
    'infolagu bohemian rhapsody'

handler.command = ['infolagu', 'play']
handler.category = ['downloader']

handler.meta = {
    fileName: 'infolagu.js',
    version: '2',
    author: 'zhuaxin',
    note: 'API cuki.biz.id — search + download mp3 sekaligus'
}

export default handler