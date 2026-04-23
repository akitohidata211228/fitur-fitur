//zhuaxin
//Convert byHidata
//Mych: https://whatsapp.com/channel/0029VbCAY4R30LKKAmwu5D0H
//sumber fitur https://whatsapp.com/channel/0029VbBSk270AgWIpspK6k3m
import { sendText } from '#helper'
import { Canvas, loadImage, FontLibrary } from 'skia-canvas'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── ASSET & FONT SETUP ───────────────────────────────────────────────────────
// Simpan asset di user/data/ba-logo/ supaya persist dan tidak re-download tiap restart
const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const BASE_DIR   = path.join(__dirname, '../data/ba-logo')
const FONT_DIR   = path.join(BASE_DIR, 'fonts')
const ASSET_DIR  = path.join(BASE_DIR, 'assets')

for (const dir of [BASE_DIR, FONT_DIR, ASSET_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function downloadFile(url, dest) {
    console.log(`[balogo] download: ${path.basename(dest)}`)
    const res    = await fetch(url)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(dest, buffer)
}

const FONT_ROG   = path.join(FONT_DIR,  'rog.otf')
const FONT_GLOW  = path.join(FONT_DIR,  'glow.otf')
const HALO_PATH  = path.join(ASSET_DIR, 'halo.png')
const CROSS_PATH = path.join(ASSET_DIR, 'cross.png')

// Download asset sekali, cached ke disk
if (!fs.existsSync(FONT_ROG))
    await downloadFile('https://raw.githubusercontent.com/uploader762/dat2/main/uploads/12678c-1776550380548.otf', FONT_ROG)
if (!fs.existsSync(FONT_GLOW))
    await downloadFile('https://raw.githubusercontent.com/uploader762/dat4/main/uploads/403297-1776550542453.otf', FONT_GLOW)
if (!fs.existsSync(HALO_PATH))
    await downloadFile('https://raw.githubusercontent.com/uploader762/dat4/main/uploads/6e7793-1776550173537.png', HALO_PATH)
if (!fs.existsSync(CROSS_PATH))
    await downloadFile('https://raw.githubusercontent.com/uploader762/dat3/main/uploads/70b790-1776550169070.png', CROSS_PATH)

FontLibrary.use('rog',  [FONT_ROG])
FontLibrary.use('glow', [FONT_GLOW])

// ─── BA LOGO RENDERER ─────────────────────────────────────────────────────────
class BALogo {
    paddingX      = 10
    horizontalTilt = -0.4
    textBaseLine  = 0.68
    canvasHeight  = 250
    canvasWidth   = 900
    fontFamily    = 'rog'

    hollowPath = [
        [284, 136],
        [321, 153],
        [159, 410],
        [148, 403],
    ]

    constructor({ fontSize = 84, transparent = false, haloX = -15, haloY = 0 } = {}) {
        this.fontSize    = fontSize
        this.transparent = transparent
        this.haloOffset  = { X: haloX, Y: haloY }
        this.font        = `${fontSize}px ${this.fontFamily}`
    }

    async draw(textL, textR) {
        // measure teks dulu di canvas sementara
        const tmp    = new Canvas(this.canvasWidth, this.canvasHeight)
        const tmpCtx = tmp.getContext('2d')
        tmpCtx.font  = this.font

        const metricsL = tmpCtx.measureText(textL)
        const metricsR = tmpCtx.measureText(textR)

        const widthL = metricsL.width -
            (this.textBaseLine * this.canvasHeight + metricsL.fontBoundingBoxDescent) * this.horizontalTilt
        const widthR = metricsR.width +
            (this.textBaseLine * this.canvasHeight - metricsR.fontBoundingBoxAscent) * this.horizontalTilt

        const canvasL = Math.max(this.canvasWidth / 2, widthL + this.paddingX)
        const canvasR = Math.max(this.canvasWidth / 2, widthR + this.paddingX)

        const finalW = canvasL + canvasR
        const final  = new Canvas(finalW, this.canvasHeight)
        const ctx    = final.getContext('2d')

        // background
        if (!this.transparent) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, finalW, this.canvasHeight)
        }

        const center = canvasL
        const y      = this.canvasHeight * this.textBaseLine

        // teks kiri — biru miring
        ctx.setTransform(1, 0, this.horizontalTilt, 1, 0, 0)
        ctx.fillStyle = '#128AFA'
        ctx.textAlign = 'end'
        ctx.font      = this.font
        ctx.fillText(textL, center, y)
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        // gambar halo
        const halo  = await loadImage(HALO_PATH)
        const cross = await loadImage(CROSS_PATH)
        const gx    = center - this.canvasHeight / 2 + this.haloOffset.X
        const gy    = this.haloOffset.Y
        ctx.drawImage(halo, gx, gy, this.canvasHeight, this.canvasHeight)

        // teks kanan — hitam dengan outline putih
        ctx.setTransform(1, 0, this.horizontalTilt, 1, 0, 0)
        ctx.textAlign   = 'start'
        ctx.lineWidth   = 12
        ctx.strokeStyle = '#ffffff'
        ctx.fillStyle   = '#2B2B2B'
        ctx.font        = this.font
        ctx.strokeText(textR, center, y)
        ctx.fillText(textR, center, y)
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        // hollow path (tutup celah antara halo & teks)
        ctx.beginPath()
        ctx.moveTo(
            gx + (this.hollowPath[0][0] / 500) * this.canvasHeight,
            gy + (this.hollowPath[0][1] / 500) * this.canvasHeight
        )
        for (let i = 1; i < 4; i++) {
            ctx.lineTo(
                gx + (this.hollowPath[i][0] / 500) * this.canvasHeight,
                gy + (this.hollowPath[i][1] / 500) * this.canvasHeight
            )
        }
        ctx.closePath()
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        // gambar cross di atas
        ctx.drawImage(cross, gx, gy, this.canvasHeight, this.canvasHeight)

        return final.toBuffer('png')
    }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
async function handler({ sock, m, jid, text, command, prefix }) {
    if (!text) {
        return await sendText(sock, jid,
            `🎨 *Blue Archive Logo Maker*\n\n` +
            `Format: *${prefix || ''}${command}* TeksKiri|TeksKanan\n\n` +
            `Contoh:\n` +
            `*${prefix || ''}${command}* Blue|Archive\n` +
            `*${prefix || ''}${command}* Genshin|Impact`,
            m
        )
    }

    if (!text.includes('|')) {
        return await sendText(sock, jid,
            `❌ Format salah! Gunakan tanda *|* sebagai pemisah.\n\nContoh: *${prefix || ''}${command}* Blue|Archive`, m)
    }

    const [rawL, rawR] = text.split('|')
    const textL = rawL?.trim()
    const textR = rawR?.trim()

    if (!textL || !textR) {
        return await sendText(sock, jid, '❌ Teks kiri dan kanan tidak boleh kosong.', m)
    }

    await sock.sendMessage(m.chatId, { react: { text: '🎨', key: m.key } })

    try {
        const buffer = await new BALogo({
            fontSize:    84,
            transparent: false,
            haloX:       -15,
            haloY:       0,
        }).draw(textL, textR)

        await sock.sendMessage(jid, {
            image:   buffer,
            caption: `🎮 *${textL}* | *${textR}*`,
            mimetype: 'image/png'
        }, { quoted: m })

        await sock.sendMessage(m.chatId, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.error('[balogo]', e.message)
        await sock.sendMessage(m.chatId, { react: { text: '❌', key: m.key } })
        await sendText(sock, jid, `❌ Gagal generate logo\n${e.message}`, m)
    }
}

handler.pluginName  = 'blue archive logo'
handler.description =
    'Buat logo gaya Blue Archive dengan dua teks.\n\n' +
    'Format: balogo TeksKiri|TeksKanan\n' +
    'Contoh: balogo Blue|Archive'
handler.command     = ['balogo', 'bluearchivelogo', 'balog']
handler.category    = ['canvas']

handler.meta = {
    fileName: 'balogo.js',
    version:  '1',
    author:   'converted',
    note:     'Blue Archive logo maker — butuh skia-canvas di package.json',
}

export default handler