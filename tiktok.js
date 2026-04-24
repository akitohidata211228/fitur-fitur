import axios from 'axios'
import crypto from 'node:crypto'
import { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } from 'baileys'
import { sendText, bot } from '#helper'

async function tikwm(url) {
    const res = await axios.post(
        'https://www.tikwm.com/api/',
        new URLSearchParams({
            url,
            count: '12',
            cursor: '0',
            web: '1',
            hd: '1'
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
            },
            timeout: 20000
        }
    )

    const json = res.data

    if (!json || json.code !== 0 || !json.data) {
        throw new Error(json?.msg || 'API tikwm gagal mengembalikan data')
    }

    const d = json.data
    const base = 'https://www.tikwm.com'

    const fixUrl = (v) => {
        if (typeof v !== 'string' || !v) return null
        if (v.startsWith('http')) return v
        if (v.startsWith('/')) return base + v
        if (v.length >= 5) return base + '/' + v
        return null
    }

    console.log('[tiktok:raw] play:', JSON.stringify(d.play))
    console.log('[tiktok:raw] hdplay:', JSON.stringify(d.hdplay))
    console.log('[tiktok:raw] music:', JSON.stringify(d.music))
    console.log(
        '[tiktok:raw] images:',
        Array.isArray(d.images) ? d.images.length + ' items' : d.images
    )

    d.play = fixUrl(d.play)
    d.hdplay = fixUrl(d.hdplay)
    d.wmplay = fixUrl(d.wmplay)
    d.music = fixUrl(d.music)
    d.cover = fixUrl(d.cover)

    if (Array.isArray(d.images)) {
        d.images = d.images.map(fixUrl).filter(Boolean)
    }

    console.log('[tiktok:fix] play:', d.play)
    console.log('[tiktok:fix] music:', d.music)

    return d
}

const DL_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.tiktok.com/'
}

async function fetchBuffer(url, timeoutMs = 60000) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        headers: DL_HEADERS
    })

    return Buffer.from(res.data)
}

function fNum(n) {
    if (!n && n !== 0) return '-'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return String(n)
}

async function sendAlbum(sock, jid, mediaList, quotedMsg) {
    const userJid = jidNormalizedUser(bot.pn)

    const opener = await generateWAMessageFromContent(
        jid,
        {
            messageContextInfo: {
                messageSecret: crypto.randomBytes(32)
            },
            albumMessage: {
                expectedImageCount: mediaList.length,
                expectedVideoCount: 0
            }
        },
        {
            userJid,
            quoted: quotedMsg,
            upload: sock.waUploadToServer
        }
    )

    await sock.relayMessage(
        opener.key.remoteJid,
        opener.message,
        {
            messageId: opener.key.id
        }
    )

    for (const content of mediaList) {
        const msg = await generateWAMessage(
            opener.key.remoteJid,
            content,
            {
                upload: sock.waUploadToServer
            }
        )

        msg.message.messageContextInfo = {
            messageSecret: crypto.randomBytes(32),
            messageAssociation: {
                associationType: 1,
                parentMessageKey: opener.key
            }
        }

        await sock.relayMessage(
            msg.key.remoteJid,
            msg.message,
            {
                messageId: msg.key.id
            }
        )
    }
}

async function handler({ sock, m, jid, text, prefix, command }) {
    if (!text) {
        return await sendText(
            sock,
            jid,
            `*[ TikTok Download ]*\n\n` +
            `Usage: ${prefix || ''}${command} <url>\n` +
            `Contoh: ${prefix || ''}${command} https://vt.tiktok.com/xxx`,
            m
        )
    }

    if (!text.match(/tiktok\.com|vt\.tiktok/i)) {
        return await sendText(
            sock,
            jid,
            '* URL tidak valid. Gunakan link TikTok.',
            m
        )
    }

    await sock.sendMessage(jid, {
        react: {
            text: '⏱️',
            key: m.key
        }
    })

    try {
        const d = await tikwm(text)

        const isSlide = Array.isArray(d.images) && d.images.length > 0
        const mediaIcon = isSlide ? '🖼️' : '🎬'

        const caption =
            `${mediaIcon} *${d.title || d.author?.nickname || 'TikTok'}*\n` +
            `${'─'.repeat(28)}\n` +
            `👤  ${d.author?.nickname || '-'}\n\n` +
            `👁️  ${fNum(d.play_count)}  views\n` +
            `❤️  ${fNum(d.digg_count)}  likes\n` +
            `💬  ${fNum(d.comment_count)}  comments\n` +
            `↗️  ${fNum(d.share_count)}  shares\n` +
            `⏱️  ${d.duration ? d.duration + ' detik' : '-'}\n` +
            `${'─'.repeat(28)}\n` +
            `> 🤖 _Download By Zhuaxin_`

        if (Array.isArray(d.images) && d.images.length > 0) {
            await sendText(
                sock,
                jid,
                ` *Mengirim ${d.images.length} slide...*`,
                m
            )

            const mediaList = []

            for (let i = 0; i < d.images.length; i++) {
                const imgUrl = d.images[i]
                if (!imgUrl) continue

                try {
                    const buf = await fetchBuffer(imgUrl, 30000)

                    mediaList.push({
                        image: buf,
                        caption: i === 0 ? caption : ''
                    })
                } catch (e) {
                    console.error(
                        `[tiktok] gagal download slide ${i + 1}:`,
                        e.message
                    )
                }
            }

            if (mediaList.length === 0) {
                throw new Error('Gagal mengunduh semua gambar slide')
            }

            await sendAlbum(sock, jid, mediaList, m)

            if (d.music) {
                try {
                    const audioBuf = await fetchBuffer(d.music, 30000)

                    await sock.sendMessage(
                        jid,
                        {
                            audio: audioBuf,
                            mimetype: 'audio/mpeg'
                        },
                        {
                            quoted: m
                        }
                    )
                } catch (e) {
                    console.error(
                        '[tiktok] gagal kirim audio slide:',
                        e.message
                    )
                }
            }

            await sock.sendMessage(jid, {
                react: {
                    text: '✅',
                    key: m.key
                }
            })

            return
        }

        const videoUrl = d.play || d.hdplay

        if (videoUrl) {
            const videoBuf = await fetchBuffer(videoUrl, 90000)

            let jpegThumbnail

            if (d.cover) {
                try {
                    jpegThumbnail = await fetchBuffer(d.cover, 10000)
                } catch {}
            }

            const msgContent = {
                video: videoBuf,
                mimetype: 'video/mp4',
                caption,
                ...(jpegThumbnail ? { jpegThumbnail } : {})
            }

            await sock.sendMessage(
                jid,
                msgContent,
                {
                    quoted: m
                }
            )

            await sock.sendMessage(jid, {
                react: {
                    text: '✅',
                    key: m.key
                }
            })

            return
        }

        if (d.music) {
            await sendText(
                sock,
                jid,
                ` *NOTE*\n> Tidak ada video/slide, mengirim audio saja...`,
                m
            )

            const audioBuf = await fetchBuffer(d.music, 30000)

            await sock.sendMessage(
                jid,
                {
                    audio: audioBuf,
                    mimetype: 'audio/mpeg'
                },
                {
                    quoted: m
                }
            )

            await sock.sendMessage(jid, {
                react: {
                    text: '✅',
                    key: m.key
                }
            })

            return
        }

        throw new Error('Tidak ada media yang dapat diunduh')
    } catch (err) {
        console.error('[tiktok] error:', err.message)

        await sock.sendMessage(jid, {
            react: {
                text: '❌',
                key: m.key
            }
        })

        await sendText(
            sock,
            jid,
            `* *\n\n> ${err.message}`,
            m
        )
    }
}

handler.pluginName = 'TikTok Downloader'

handler.description =
    'Download video, slide/foto dari TikTok tanpa watermark.\n\n' +
    'Penggunaan:\n' +
    'tiktok <url>\n\n' +
    'Contoh:\n' +
    'tiktok https://vt.tiktok.com/xxx'

handler.command = ['tiktok', 'tt', 'ttdl']
handler.category = ['downloader']

handler.meta = {
    fileName: 'tiktok.js',
    version: '1',
    author: 'Hidata',
    note: 'tiktok downloader'
}

export default handler