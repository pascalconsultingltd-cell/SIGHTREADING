// Checks fingerings.json, then writes fingerings.txt and one SVG per scale. Run: node fingerings/make.js
const fs = require('fs'), path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fingerings.json'), 'utf8'));
// "3(23/1^[1]34)" gives slide 3 and two groups of {finger, tonic, mark}; mark is -1 for _ and +1 for ^
function parse(cell) {
  const m = cell.match(/^(\d)\((.*)\/(.*)\)$/);
  const groups = (m ? [m[2], m[3]] : [cell]).map(g => [...g.matchAll(/([_^]?)(\[?)(\d)\]?/g)].map(t => ({ finger: +t[3], tonic: !!t[2], mark: t[1] === '_' ? -1 : t[1] === '^' ? 1 : 0 })));
  return { slide: m ? +m[1] : 0, groups };
}
// Walks the scale up from the tonic, one note per finger; hand position = fret - finger
function check(scale, row) {
  const start = row.cells.findIndex(c => c), where = `${scale.name} ${row.label}`;
  let n = 0, pos = null, last = 0, errors = 0;
  row.cells.forEach((cell, s) => {
    const { slide, groups } = parse(cell);
    groups.forEach((group, g) => group.forEach((t, i) => {
      const interval = scale.intervals[n % scale.intervals.length] + 12 * Math.floor(n / scale.intervals.length), fret = interval - data.tuning[s] + data.tuning[start], at = fret - t.finger;
      const fail = text => { errors++; console.log(`ERROR ${where} string ${s + 1} "${cell}": ${text}`); };
      if (t.tonic !== (interval % 12 === 0)) fail(`finger ${t.finger} ${t.tonic ? 'is circled but is not' : 'is not circled but is'} a tonic`);
      if (g === 1 && i === 0) { if (fret - last !== slide) fail(`slide is ${fret - last} frets, written ${slide}`); }
      else if (pos !== null && t.mark) { if (at !== pos + t.mark) fail(`mark on finger ${t.finger} does not match a hand move of ${at - pos}`); }
      else if (pos !== null && at !== pos) i ? fail(`finger ${t.finger} is ${at - pos} frets off the hand position`) : console.log(`warning ${where} string ${s + 1} "${cell}": unmarked hand move of ${at - pos}`);
      n++; last = fret; pos = at;
    }));
  });
  return errors;
}
function text(scale) {
  const width = data.strings.map((_, s) => Math.max(...scale.rows.map(r => r.cells[s].length)) + 3);
  const line = (label, cells) => (label.padEnd(7) + cells.map((c, s) => c.padEnd(width[s])).join('')).trimEnd();
  return [scale.name, line('', data.strings), ...scale.rows.map(r => line(r.label + (r.common ? '*' : ''), r.cells))].join('\n');
}
function svg(scale) {
  const font = `font-family="Segoe Print, Comic Sans MS, cursive" text-anchor="middle"`, colours = { pink: '#ff4fa3', blue: '#35b8e8' };
  const colW = [90, 130, 130, 130, 130, 200, 200], x = colW.map((_, i) => 20 + colW.slice(0, i).reduce((a, b) => a + b, 0)), right = x[6] + colW[6];
  const rowH = [80, ...scale.rows.map(r => r.cells.some(c => c.includes('(')) ? 140 : 100)], y = rowH.map((_, i) => 70 + rowH.slice(0, i).reduce((a, b) => a + b, 0)), bottom = y[rowH.length - 1] + rowH[rowH.length - 1];
  const digits = (group, cx, cy, size) => group.map((t, i) => {
    const step = size * .78, tx = cx + step * (i - (group.length - 1) / 2), bar = cy + t.mark * -size * .56;
    return `<text x="${tx}" y="${cy + size * .35}" font-size="${size}" ${font}>${t.finger}</text>`
      + (t.tonic ? `<ellipse cx="${tx}" cy="${cy}" rx="${size * .4}" ry="${size * .56}" fill="none" stroke="#e0202a" stroke-width="3"/>` : '')
      + (t.mark ? `<line x1="${tx - step * .4}" x2="${tx + step * .4}" y1="${bar}" y2="${bar}" stroke="#111" stroke-width="3"/>` : '');
  }).join('');
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${right + 20} ${bottom + 20}"><rect width="100%" height="100%" fill="#fff"/><text x="${(right + 20) / 2}" y="48" font-size="38" ${font}>${scale.name}${scale.name.includes("arpeggio") ? "" : " scale"}</text>`;
  data.strings.forEach((s, i) => out += `<text x="${x[i + 1] + colW[i + 1] / 2}" y="${y[0] + 58}" font-size="52" ${font}>${s}</text>`);
  scale.rows.forEach((row, r) => {
    const top = y[r + 1], h = rowH[r + 1], cy = top + h / 2, start = row.cells.findIndex(c => c);
    if (row.common) out += `<rect x="${x[0]}" y="${top}" width="${right - x[0]}" height="${h}" fill="#fff3a8"/>`;
    out += `<rect x="${x[start + 1] + 10}" y="${top + 9}" width="${right - x[start + 1] - 20}" height="${h - 18}" rx="14" fill="none" stroke="${colours[row.family]}" stroke-width="6" opacity=".6"/>`;
    out += isNaN(row.label) ? `<text x="${x[0] + colW[0] / 2}" y="${cy + 12}" font-size="32" ${font}>${row.label}</text>`
      : `<circle cx="${x[0] + colW[0] / 2}" cy="${cy}" r="30" fill="none" stroke="#111" stroke-width="3"/><text x="${x[0] + colW[0] / 2}" y="${cy + 14}" font-size="40" ${font}>${row.label}</text>`;
    row.cells.forEach((cell, s) => {
      const { slide, groups } = parse(cell), cx = x[s + 1] + colW[s + 1] / 2;
      if (!slide) return out += digits(groups[0], cx, cy, 46);
      const wide = Math.max(...groups.map(g => g.length)) * 34 * .78, left = cx - (wide + 60) / 2;
      out += `<text x="${left + 14}" y="${cy + 16}" font-size="46" ${font}>${slide}</text><path d="M${left + 52} ${cy - 54} Q${left + 22} ${cy} ${left + 52} ${cy + 54}" fill="none" stroke="#111" stroke-width="3"/>`;
      groups.forEach((g, i) => out += digits(g, left + 60 + wide / 2, cy + (i ? 28 : -28), 34));
    });
  });
  y.concat(bottom).forEach(v => out += `<line x1="${x[0]}" x2="${right}" y1="${v}" y2="${v}" stroke="#111" stroke-width="3"/>`);
  x.concat(right).forEach(v => out += `<line x1="${v}" x2="${v}" y1="${y[0]}" y2="${bottom}" stroke="#111" stroke-width="3"/>`);
  return out + '</svg>';
}
const errors = data.scales.reduce((sum, scale) => sum + scale.rows.reduce((a, row) => a + check(scale, row), 0), 0);
if (errors) { console.log(`${errors} errors, nothing written`); process.exit(1); }
const legend = Object.entries(data.notation).map(([k, v]) => `${k.padEnd(8)}${v}`).join('\n');
fs.writeFileSync(path.join(__dirname, 'fingerings.txt'), `Guitar scale fingerings. Rows: patterns. Columns: strings, low to high.\n\n${legend}\n\n${data.scales.map(text).join('\n\n')}\n`);
data.scales.forEach(scale => fs.writeFileSync(path.join(__dirname, `${scale.file}.svg`), svg(scale)));
console.log('checked, files written');
