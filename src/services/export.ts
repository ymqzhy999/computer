import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface ExportLine {
  category: string
  model: string
  price: number | null
  condition: string
  reason?: string
}

export interface ExportPayload {
  name: string
  lines: ExportLine[]
  total: number
  budget?: number
  power: { peak: number; recommendedPsu: number; headroom: number }
  performance: { index: number; gaming: number; productivity: number; balance: number }
  compatibility: string
  notes?: string[]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'pc-forge-build'
}

export function exportCsv(payload: ExportPayload) {
  const rows: string[][] = [
    ['PC FORGE 配置清单', payload.name],
    ['导出时间', new Date().toLocaleString('zh-CN', { hour12: false })],
    ['类别', '型号', '参考价(CNY)', '成色', '选择理由'],
    ...payload.lines.map((line) => [
      line.category,
      line.model,
      line.price == null ? '暂无报价' : String(line.price),
      line.condition,
      line.reason ?? '',
    ]),
    [],
    ['整机合计', '', String(payload.total)],
    ['预算', '', payload.budget == null ? '未指定' : String(payload.budget)],
    ['峰值功耗(W)', '', String(payload.power.peak)],
    ['建议电源(W)', '', String(payload.power.recommendedPsu)],
    ['性能指数', '', String(payload.performance.index)],
    ['兼容状态', '', payload.compatibility],
    [],
    ['说明', '价格来自公开渠道归档样本，非实时成交价；导出时请以渠道页面为准。'],
  ]
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')}`
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeName(payload.name)}.csv`)
}

function buildPdfNode(payload: ExportPayload): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    'width:794px',
    'padding:48px',
    'background:#ffffff',
    'color:#101820',
    'font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif',
    'box-sizing:border-box',
  ].join(';')

  const lineRows = payload.lines
    .map(
      (line) => `
      <tr>
        <td style="padding:9px 10px;border-bottom:1px solid #dce4e9;color:#5a6a75;font-size:11px;letter-spacing:.06em">${line.category}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #dce4e9;font-size:12px">${line.model}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #dce4e9;text-align:right;font-size:12px;white-space:nowrap">${line.price == null ? '暂无报价' : `¥${line.price.toLocaleString('zh-CN')}`}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #dce4e9;font-size:11px;color:#5a6a75">${line.condition}</td>
      </tr>`,
    )
    .join('')

  wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0a7f9c;padding-bottom:18px;margin-bottom:24px">
      <div>
        <div style="font-size:12px;letter-spacing:.22em;color:#0a7f9c;font-weight:700">PC FORGE / DIGITAL TWIN ASSEMBLY LAB</div>
        <h1 style="margin:8px 0 4px;font-size:27px;letter-spacing:.04em">${payload.name}</h1>
        <div style="font-size:11px;color:#6a7b86">装配配置单 · BUILD MANIFEST</div>
      </div>
      <div style="text-align:right;font-size:10px;color:#6a7b86;line-height:1.7">
        <div>GENERATED ${new Date().toLocaleString('zh-CN', { hour12: false })}</div>
        <div>REGION CN / CURRENCY CNY</div>
        <div>STATUS ${payload.compatibility.toUpperCase()}</div>
      </div>
    </div>
    <div style="display:flex;gap:14px;margin-bottom:22px">
      <div style="flex:1;border:1px solid #d8e1e6;padding:14px 16px">
        <div style="font-size:9px;color:#6a7b86;letter-spacing:.12em">TOTAL / 整机参考价</div>
        <div style="font-size:24px;font-weight:700;color:#0a6178;margin-top:4px">¥${payload.total.toLocaleString('zh-CN')}</div>
      </div>
      <div style="flex:1;border:1px solid #d8e1e6;padding:14px 16px">
        <div style="font-size:9px;color:#6a7b86;letter-spacing:.12em">POWER / 功耗与电源</div>
        <div style="font-size:17px;font-weight:700;margin-top:6px">${payload.power.peak}W <span style="font-size:11px;font-weight:400;color:#5a6a75">峰值 · 建议 ${payload.power.recommendedPsu}W</span></div>
      </div>
      <div style="flex:1;border:1px solid #d8e1e6;padding:14px 16px">
        <div style="font-size:9px;color:#6a7b86;letter-spacing:.12em">PERFORMANCE / 性能</div>
        <div style="font-size:17px;font-weight:700;margin-top:6px">PF ${payload.performance.index} <span style="font-size:11px;font-weight:400;color:#5a6a75">游戏 ${payload.performance.gaming}</span></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
      <thead>
        <tr style="background:#eef4f7">
          <th style="text-align:left;padding:8px 10px;font-size:9px;color:#5a6a75;letter-spacing:.1em">类别</th>
          <th style="text-align:left;padding:8px 10px;font-size:9px;color:#5a6a75;letter-spacing:.1em">型号</th>
          <th style="text-align:right;padding:8px 10px;font-size:9px;color:#5a6a75;letter-spacing:.1em">参考价</th>
          <th style="text-align:left;padding:8px 10px;font-size:9px;color:#5a6a75;letter-spacing:.1em">成色</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
    <div style="font-size:10px;line-height:1.8;color:#5a6a75;border-top:1px solid #d8e1e6;padding-top:14px">
      <div>兼容检查：${payload.compatibility} · 装配前请再次核对 BIOS、显卡长度、散热器高度与电源接口。</div>
      <div>价格说明：本清单使用公开渠道归档样本与用户导入数据，不代表实时库存或成交价；请以京东、天猫品牌官方店等渠道页面为准。</div>
      <div>PC FORGE 仅提供配置规划与可视化参考，不销售硬件。</div>
    </div>
  `
  document.body.appendChild(wrapper)
  return wrapper
}

export async function exportPdf(payload: ExportPayload) {
  const node = buildPdfNode(payload)
  try {
    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    })
    const image = canvas.toDataURL('image/jpeg', 0.94)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const pageHeight = 297
    const margin = 8
    const imageWidth = pageWidth - margin * 2
    const imageHeight = (canvas.height * imageWidth) / canvas.width
    let remaining = imageHeight
    let position = margin
    pdf.addImage(image, 'JPEG', margin, position, imageWidth, imageHeight)
    remaining -= pageHeight - margin * 2
    while (remaining > 0) {
      position = margin - (imageHeight - remaining)
      pdf.addPage()
      pdf.addImage(image, 'JPEG', margin, position, imageWidth, imageHeight)
      remaining -= pageHeight - margin * 2
    }
    pdf.save(`${safeName(payload.name)}.pdf`)
  } finally {
    node.remove()
  }
}

export function exportJson(filename: string, data: unknown) {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${safeName(filename)}.json`,
  )
}
