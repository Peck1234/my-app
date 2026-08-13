import { Platform } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

const ACCENT = '#2E7CF6' // Aurora accent blue - kept in sync with src/theme.js colors.accent
const INK = '#0F1115'
const MUTED = '#767B82'
const BORDER = '#EBEBED'
const BG = '#F6F8FC'

function barRowsHtml(rows, labelKey, valueKey, totalKey) {
  return rows
    .map((row) => {
      const value = row[valueKey]
      const total = row[totalKey]
      const pct = total > 0 ? Math.round((value / total) * 100) : 0
      return `
        <div class="bar-row">
          <div class="bar-row-top">
            <span>${row[labelKey]}</span>
            <span class="muted">${value}/${total} (${pct}%)</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>`
    })
    .join('')
}

function drugRowsHtml(rows, maxTotal) {
  return rows
    .map((row) => {
      const pct = Math.round((row.total / maxTotal) * 100)
      return `
        <div class="drug-row">
          <span class="drug-name">${row.drug_name}</span>
          <div class="bar-track drug-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="drug-count">${row.total}</span>
        </div>`
    })
    .join('')
}

function trendBarsHtml(trend, maxTrend) {
  return trend
    .map((d) => {
      const pct = Math.round((d.dispensed / maxTrend) * 100)
      return `
        <div class="trend-col">
          <div class="trend-track"><div class="trend-fill" style="height:${pct}%"></div></div>
          <span class="trend-label">${d.date.slice(5)}</span>
        </div>`
    })
    .join('')
}

function buildHtml(stats) {
  const generatedAt = new Date().toLocaleString('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const maxTrend = Math.max(1, ...stats.trend.map((d) => d.dispensed))
  const maxDrugTotal = Math.max(1, ...stats.by_drug.map((d) => d.total))

  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: 'Sarabun', -apple-system, 'Segoe UI', 'Leelawadee UI', sans-serif;
        color: ${INK};
        background: #fff;
        margin: 0;
        padding: 32px 36px;
      }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .meta { color: ${MUTED}; font-size: 12px; margin: 0 0 24px; }
      .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; }
      .kpi {
        flex: 1;
        background: ${INK};
        color: #fff;
        border-radius: 12px;
        padding: 16px 18px;
      }
      .kpi .label { font-size: 11px; color: rgba(255,255,255,0.65); margin-bottom: 6px; }
      .kpi .value { font-size: 26px; font-weight: 700; }
      .card {
        border: 1px solid ${BORDER};
        border-radius: 12px;
        padding: 16px 18px;
        margin-bottom: 16px;
        background: ${BG};
        page-break-inside: avoid;
      }
      .card h2 { font-size: 13px; margin: 0 0 14px; }
      .muted { color: ${MUTED}; font-size: 11px; }
      .bar-row { margin-bottom: 12px; }
      .bar-row:last-child { margin-bottom: 0; }
      .bar-row-top { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; }
      .bar-track { height: 7px; border-radius: 999px; background: #fff; border: 1px solid ${BORDER}; overflow: hidden; }
      .bar-fill { height: 100%; background: ${ACCENT}; border-radius: 999px; }
      .drug-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid ${BORDER}; font-size: 12.5px; }
      .drug-row:last-child { border-bottom: none; }
      .drug-name { width: 130px; flex-shrink: 0; }
      .drug-track { flex: 1; }
      .drug-count { width: 28px; text-align: right; color: ${MUTED}; }
      .trend-row { display: flex; justify-content: space-between; align-items: flex-end; height: 90px; }
      .trend-col { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; width: 32px; }
      .trend-track { width: 18px; height: 64px; border-radius: 4px; background: #fff; border: 1px solid ${BORDER}; display: flex; align-items: flex-end; overflow: hidden; }
      .trend-fill { width: 100%; background: ${ACCENT}; }
      .trend-label { font-size: 9px; color: ${MUTED}; }
    </style>
  </head>
  <body>
    <h1>สรุปสถิติการจ่ายยา</h1>
    <p class="meta">สร้างเมื่อ ${generatedAt}</p>

    <div class="kpi-row">
      <div class="kpi">
        <div class="label">อัตราจ่ายยาแล้ว</div>
        <div class="value">${stats.dispensed_rate}%</div>
      </div>
      <div class="kpi">
        <div class="label">จ่ายแล้ว / ทั้งหมด</div>
        <div class="value">${stats.dispensed} / ${stats.total}</div>
      </div>
    </div>

    <div class="card">
      <h2>แนวโน้ม 7 วันล่าสุด</h2>
      <div class="trend-row">${trendBarsHtml(stats.trend, maxTrend)}</div>
    </div>

    <div class="card">
      <h2>ตามช่วงเวลา</h2>
      ${barRowsHtml(stats.by_time_slot.map((r) => ({ ...r, slot: `${r.slot} น.` })), 'slot', 'dispensed', 'total')}
    </div>

    <div class="card">
      <h2>ตามวอร์ด</h2>
      ${barRowsHtml(stats.by_ward, 'ward', 'dispensed', 'total')}
    </div>

    <div class="card">
      <h2>ตามรายการยา</h2>
      ${drugRowsHtml(stats.by_drug, maxDrugTotal)}
    </div>
  </body>
  </html>`
}

export async function exportStatsPdf(stats) {
  const html = buildHtml(stats)

  if (Platform.OS === 'web') {
    await Print.printAsync({ html })
    return
  }

  const { uri } = await Print.printToFileAsync({ html })
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
  }
}
