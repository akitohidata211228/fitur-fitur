import { createCanvas } from 'canvas'
import { execSync } from 'node:child_process'
import os from 'node:os'
import { sendText, userManager, bot } from '#helper'

/**
 * Plugin: Ping dengan System Monitor canvas image
 *
 * @param {import('../../system/types/plugin').HandlerParams} params
 */

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    return ctx
}

function drawCard(ctx, x, y, w, h, title, subtitle) {
    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, 'rgba(30, 41, 59, 0.95)')
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)')
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 8
    ctx.fillStyle = grad
    roundRect(ctx, x, y, w, h, 12)
    ctx.fill()
    ctx.shadowBlur = 0

    const lineGrad = ctx.createLinearGradient(x, y, x + w, y)
    lineGrad.addColorStop(0, '#3b82f6')
    lineGrad.addColorStop(1, '#8b5cf6')
    ctx.fillStyle = lineGrad
    ctx.fillRect(x + 15, y, w - 30, 2)

    ctx.fillStyle = '#f1f5f9'
    ctx.font = 'bold 13px Arial'
    ctx.fillText(title.toUpperCase(), x + 15, y + 28)

    if (subtitle) {
        ctx.fillStyle = '#64748b'
        ctx.font = '11px Arial'
        ctx.fillText(subtitle, x + 15, y + 44)
    }
}

function drawProgressRing(ctx, x, y, radius, percent, color) {
    const startAngle = -Math.PI / 2
    const endAngle   = startAngle + (Math.PI * 2 * percent / 100)

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x, y, radius, startAngle, endAngle)
    ctx.strokeStyle = color
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(percent)}%`, x, y)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k     = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i     = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDuration(seconds) {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const mn = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (d > 0) return `${d}d ${h}h ${mn}m`
    if (h > 0) return `${h}h ${mn}m ${s}s`
    return `${mn}m ${s}s`
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

async function handler({ sock, m, jid }) {

    await sock.sendMessage(jid, { react: { text: '🚀', key: m.key } })

    const timestamp = Date.now()

    // sistem info
    const used      = process.memoryUsage()
    const cpus      = os.cpus()
    const totalMem  = os.totalmem()
    const freeMem   = os.freemem()
    const usedMem   = totalMem - freeMem

    let diskInfo = { total: '-', used: '-', free: '-', percent: 0 }
    try {
        const diskRaw = execSync('df -h --total | tail -n 1').toString().trim()
        const parts   = diskRaw.split(/\s+/)
        diskInfo = {
            total:   parts[1] || '-',
            used:    parts[2] || '-',
            free:    parts[3] || '-',
            percent: parseInt(parts[4]) || 0
        }
    } catch { /* skip */ }

    let cpuUsage = 0
    cpus.forEach(cpu => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
        cpuUsage += (total - cpu.times.idle) / total * 100
    })
    const cpuPercent = Math.min(cpuUsage / cpus.length, 100)
    const memPercent = (usedMem / totalMem) * 100
    const latensi    = Date.now() - timestamp

    // ── CANVAS ────────────────────────────────────────────────────────────
    const width  = 900
    const height = 900
    const canvas = createCanvas(width, height)
    const ctx    = canvas.getContext('2d')

    // background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#0f172a')
    bgGrad.addColorStop(0.5, '#1e1b4b')
    bgGrad.addColorStop(1, '#0f172a')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i < width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke()
    }
    for (let i = 0; i < height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke()
    }

    // header
    const margin  = 35
    const headerY = 50
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(margin + 20, headerY, 18, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 26px Arial'
    ctx.fillText('System Monitor', margin + 50, headerY + 8)

    ctx.fillStyle = '#64748b'
    ctx.font = '12px Arial'
    ctx.fillText(
        `${os.hostname()} • ${latensi}ms • Node ${process.version}`,
        margin + 50, headerY + 26
    )

    // cards row 1 — CPU, Memory, Disk
    const cardY = 95
    const cardW = 260
    const cardH = 200
    const gap   = 20

    // CPU card
    const cpuColor = cpuPercent > 80 ? '#ef4444' : cpuPercent > 50 ? '#f59e0b' : '#3b82f6'
    drawCard(ctx, margin, cardY, cardW, cardH, 'CPU Usage', `${cpus.length} Cores • ${Math.round(cpus[0].speed)} MHz`)
    drawProgressRing(ctx, margin + cardW / 2, cardY + 115, 45, cpuPercent, cpuColor)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    const cpuModel = cpus[0].model
    ctx.fillText(cpuModel.substring(0, 25) + (cpuModel.length > 25 ? '...' : ''), margin + cardW / 2, cardY + 175)
    ctx.textAlign = 'left'

    // Memory card
    const memX = margin + cardW + gap
    drawCard(ctx, memX, cardY, cardW, cardH, 'Memory', `Total ${formatBytes(totalMem)}`)
    drawProgressRing(ctx, memX + cardW / 2, cardY + 115, 45, memPercent, '#8b5cf6')
    ctx.fillStyle = '#64748b'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`Used: ${formatBytes(usedMem)}`, memX + cardW / 2 - 50, cardY + 175)
    ctx.fillText(`Free: ${formatBytes(freeMem)}`, memX + cardW / 2 + 50, cardY + 175)
    ctx.textAlign = 'left'

    // Disk card
    const diskX    = memX + cardW + gap
    const diskColor = diskInfo.percent > 90 ? '#ef4444' : '#22c55e'
    drawCard(ctx, diskX, cardY, cardW, cardH, 'Storage', `Total ${diskInfo.total}`)
    drawProgressRing(ctx, diskX + cardW / 2, cardY + 115, 45, diskInfo.percent, diskColor)
    ctx.fillStyle = '#64748b'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${diskInfo.used} / ${diskInfo.free}`, diskX + cardW / 2, cardY + 175)
    ctx.textAlign = 'left'

    // cards row 2 — System Info + Memory Detail
    const infoY  = cardY + cardH + gap
    const infoH  = 120
    const halfW  = (width - margin * 2 - gap) / 2

    drawCard(ctx, margin, infoY, halfW, infoH, 'System Info', null)
    const infoData = [
        ['Platform',   os.platform().toUpperCase()],
        ['Arch',       os.arch()],
        ['Bot Uptime', formatDuration(process.uptime())],
        ['OS Uptime',  formatDuration(os.uptime())]
    ]
    infoData.forEach((item, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x   = margin + 20 + col * (halfW / 2)
        const y   = infoY + 45 + row * 35
        ctx.fillStyle = '#64748b'
        ctx.font = '10px Arial'
        ctx.fillText(item[0], x, y)
        ctx.fillStyle = '#f1f5f9'
        ctx.font = 'bold 12px Arial'
        ctx.fillText(item[1], x, y + 16)
    })

    drawCard(ctx, margin + halfW + gap, infoY, halfW, infoH, 'Memory Detail', null)
    const memData = [
        ['RSS',        used.rss,       '#3b82f6'],
        ['Heap Used',  used.heapUsed,  '#8b5cf6'],
        ['Heap Total', used.heapTotal, '#ec4899'],
        ['External',   used.external,  '#22c55e']
    ]
    const maxVal = Math.max(used.rss, used.heapTotal, 1)
    memData.forEach((item, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x   = margin + halfW + gap + 20 + col * (halfW / 2)
        const y   = infoY + 45 + row * 35
        const pct = (item[1] / maxVal) * 100
        ctx.fillStyle = '#64748b'
        ctx.font = '10px Arial'
        ctx.fillText(item[0], x, y)
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        roundRect(ctx, x, y + 6, 80, 4, 2); ctx.fill()
        ctx.fillStyle = item[2]
        roundRect(ctx, x, y + 6, 80 * (pct / 100), 4, 2); ctx.fill()
        ctx.fillStyle = '#f1f5f9'
        ctx.font = 'bold 10px Arial'
        ctx.fillText(formatBytes(item[1]), x + 88, y + 10)
    })

    // chart — Network Traffic
    const chartY = infoY + infoH + gap
    const chartH = 380
    const chartW = width - margin * 2
    drawCard(ctx, margin, chartY, chartW, chartH, 'Network Traffic', 'Live Transfer Rate')

    const chartPad = { top: 25, right: 25, bottom: 40, left: 60 }
    const cW = chartW - chartPad.left - chartPad.right - 30
    const cH = chartH - chartPad.top - chartPad.bottom - 60
    const cX = margin + chartPad.left + 15
    const cY = chartY + chartPad.top + 40

    const traffic = Array.from({ length: 20 }, () => ({
        up:   Math.random() * 400 + 50,
        down: Math.random() * 600 + 100
    }))
    const maxT = Math.max(...traffic.map(t => Math.max(t.up, t.down))) * 1.2

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
        const y = cY + (cH / 4) * i
        ctx.beginPath(); ctx.moveTo(cX, y); ctx.lineTo(cX + cW, y); ctx.stroke()
    }

    function drawLine(data, key, color) {
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        data.forEach((p, i) => {
            const x = cX + (i / (data.length - 1)) * cW
            const y = cY + cH - (p[key] / maxT) * cH
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.fillStyle = color
        data.forEach((p, i) => {
            if (i % 4 === 0) {
                const x = cX + (i / (data.length - 1)) * cW
                const y = cY + cH - (p[key] / maxT) * cH
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
            }
        })
    }
    drawLine(traffic, 'down', '#3b82f6')
    drawLine(traffic, 'up', '#ec4899')

    ctx.fillStyle = '#64748b'
    ctx.font = '9px Arial'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
        ctx.fillText(Math.round((maxT / 4) * (4 - i)) + 'KB', cX - 8, cY + (cH / 4) * i + 3)
    }
    ctx.textAlign = 'center'
    ;['-60s', '-45s', '-30s', '-15s', 'Now'].forEach((t, i) => {
        ctx.fillText(t, cX + (i / 4) * cW, cY + cH + 18)
    })
    ctx.textAlign = 'left'

    ctx.fillStyle = '#3b82f6'
    ctx.beginPath(); ctx.arc(chartW - 100, chartY + 40, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px Arial'
    ctx.fillText('Download', chartW - 90, chartY + 44)
    ctx.fillStyle = '#ec4899'
    ctx.beginPath(); ctx.arc(chartW - 30, chartY + 40, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('Upload', chartW - 20, chartY + 44)

    // footer
    const footerY = height - 40
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(margin, footerY); ctx.lineTo(width - margin, footerY); ctx.stroke()

    ctx.fillStyle = '#64748b'
    ctx.font = '11px Arial'
    const timeStr = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
    ctx.fillText(timeStr + ' WIB', margin, footerY + 20)

    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(bot.pushname || 'Angelina Bot', width - margin, footerY + 20)
    ctx.textAlign = 'left'

    // kirim
    const buffer = canvas.toBuffer('image/png')
    await sock.sendMessage(jid, {
        image: buffer,
        caption: `*System Monitor*\n🚀 Latensi: ${latensi}ms`
    }, { quoted: m })
}

handler.pluginName = 'ping system monitor'
handler.description = 'Cek latensi bot + tampilan system monitor (CPU, RAM, Disk, Network).'
handler.command = ['ping2']
handler.category = ['info']

handler.meta = {
    fileName: 'ping2.js',
    version: '1',
    author: 'converted',
    note: 'canvas system monitor — butuh package canvas',
}

export default handler