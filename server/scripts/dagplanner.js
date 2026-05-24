'use strict';
const PDFDocument = require('pdfkit');

const mm = v => v * 2.8346;
const A4_W = 595.28;
const ML = mm(14);
const MR = mm(14);
const USABLE_W = A4_W - ML - MR;

const C = {
  donkerblauw:  '#1e3a5f',
  middelblauw:  '#2d6a9f',
  lichtblauw:   '#dbeafe',
  accentblauw:  '#3b82f6',
  groen:        '#166534',
  lichtgroen:   '#dcfce7',
  rood:         '#991b1b',
  lichtrood:    '#fee2e2',
  oranje:       '#92400e',
  lichtoranje:  '#fef3c7',
  grijs:        '#374151',
  lichtgrijs:   '#f9fafb',
  midgrijs:     '#e5e7eb',
  midgrijsD:    '#6b7280',
  wit:          '#ffffff',
  zwart:        '#111827',
};

const DAG_NL   = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
const MAAND_NL = ['','januari','februari','maart','april','mei','juni',
                  'juli','augustus','september','oktober','november','december'];

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDatum(s) {
  const d = parseDate(s);
  return `${d.getDate()} ${MAAND_NL[d.getMonth() + 1]} ${d.getFullYear()}`;
}

function dagNaam(s) {
  const d = parseDate(s);
  const dow = d.getDay();
  return DAG_NL[dow === 0 ? 6 : dow - 1];
}

function morgenStr(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() + 1);
  return `${d.getDate()} ${MAAND_NL[d.getMonth() + 1]}`;
}

function genereerDagplanner(data, outputStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: mm(12), bottom: mm(12), left: ML, right: MR },
    autoFirstPage: true,
    info: { Title: 'GTD Dagplanner', Creator: 'Mail Analyzer' },
  });

  doc.pipe(outputStream);

  const {
    datum,
    taken_vandaag   = [],
    deadline_taken  = [],
    taken_morgen    = [],
    tijdblokken     = [],
    intentie_dag    = '',
    notities_ruimte = true,
  } = data;

  const X = ML;
  let y = mm(12);

  // ── Drawing helpers ──────────────────────────────────────

  function fillRect(x, fy, w, h, color, r = 0) {
    doc.save();
    doc.fillColor(color);
    r > 0 ? doc.roundedRect(x, fy, w, h, r).fill()
           : doc.rect(x, fy, w, h).fill();
    doc.restore();
  }

  function strokeRect(x, fy, w, h, color, lw = 0.5, r = 0) {
    doc.save();
    doc.strokeColor(color).lineWidth(lw);
    r > 0 ? doc.roundedRect(x, fy, w, h, r).stroke()
           : doc.rect(x, fy, w, h).stroke();
    doc.restore();
  }

  function checkbox(x, fy) {
    doc.save();
    doc.fillColor(C.wit).strokeColor(C.midgrijsD).lineWidth(1.2);
    doc.roundedRect(x, fy, 11, 11, 2).fillAndStroke();
    doc.restore();
  }

  function circle(cx, cy, r = 3.5) {
    doc.save();
    doc.strokeColor(C.accentblauw).lineWidth(0.8);
    doc.circle(cx, cy, r).stroke();
    doc.restore();
  }

  function sectionHdr(text, fx, fy, w, color) {
    const h = mm(8);
    fillRect(fx, fy, w, h, color, 3);
    doc.save();
    doc.fillColor(C.wit).font('Helvetica-Bold').fontSize(10);
    doc.text(text, fx + 8, fy + (h - 10) / 2 + 1, { lineBreak: false, width: w - 16 });
    doc.restore();
    return h;
  }

  // ── HEADER ──────────────────────────────────────────────
  const hdrH = mm(17);
  fillRect(X, y, USABLE_W, hdrH, C.donkerblauw, 4);

  doc.save();
  doc.fillColor(C.wit).font('Helvetica-Bold').fontSize(16);
  doc.text(`Dagplanner  ${dagNaam(datum)}`, X + 10, y + 7, { lineBreak: false });
  doc.fillColor('#bfdbfe').font('Helvetica').fontSize(9);
  doc.text(`${fmtDatum(datum)}  |  GTD Productiviteitssysteem`, X + 10, y + 26, { lineBreak: false });
  doc.restore();

  doc.save();
  doc.fillColor(C.wit).font('Helvetica-Bold').fontSize(11);
  doc.text(`Morgen: ${morgenStr(datum)}`, X + USABLE_W - 145, y + 8,
    { lineBreak: false, width: 140, align: 'right' });
  doc.fillColor('#bfdbfe').font('Helvetica').fontSize(9);
  doc.text(`${taken_vandaag.length} taken  |  ${deadline_taken.length} deadlines`,
    X + USABLE_W - 145, y + 25, { lineBreak: false, width: 140, align: 'right' });
  doc.restore();

  y += hdrH + mm(3);

  // ── INTENTIE + 3 WINSTEN ────────────────────────────────
  const intH  = mm(19);
  const intW  = Math.round(USABLE_W * 0.66);
  const winW  = USABLE_W - intW - 2;

  fillRect(X, y, intW, intH, C.lichtblauw, 3);
  strokeRect(X, y, intW, intH, C.accentblauw, 0.5, 3);
  doc.save();
  doc.fillColor(C.midgrijsD).font('Helvetica-Bold').fontSize(8);
  doc.text('Intentie van de dag', X + 8, y + 5, { lineBreak: false });
  doc.fillColor(C.donkerblauw).font('Helvetica-Oblique').fontSize(9);
  doc.text(intentie_dag || '_'.repeat(50), X + 8, y + 16, { lineBreak: false, width: intW - 16 });
  doc.restore();

  fillRect(X + intW + 2, y, winW, intH, C.lichtgroen, 3);
  strokeRect(X + intW + 2, y, winW, intH, '#86efac', 0.5, 3);
  doc.save();
  doc.fillColor(C.midgrijsD).font('Helvetica-Bold').fontSize(8);
  doc.text('3 winsten van vandaag', X + intW + 10, y + 5, { lineBreak: false });
  doc.fillColor(C.zwart).font('Helvetica').fontSize(8);
  for (let i = 0; i < 3; i++) {
    doc.text(`${i + 1}. ______________________________`, X + intW + 10, y + 16 + i * 10,
      { lineBreak: false, width: winW - 16 });
  }
  doc.restore();

  y += intH + mm(3);

  // ── ENERGIE METER ────────────────────────────────────────
  const engH   = mm(10);
  const engMid = y + engH / 2;
  fillRect(X, y, USABLE_W, engH, C.lichtblauw, 3);
  strokeRect(X, y, USABLE_W, engH, C.accentblauw, 0.5, 3);

  doc.save();
  doc.fillColor(C.grijs).font('Helvetica-Bold').fontSize(8);
  doc.text('Energie ochtend', X + 8, y + (engH - 8) / 2, { lineBreak: false });
  doc.restore();
  for (let i = 0; i < 5; i++) circle(X + 100 + i * 14, engMid);

  doc.save();
  doc.fillColor(C.grijs).font('Helvetica-Bold').fontSize(8);
  doc.text('Energie middag', X + USABLE_W / 2 + 8, y + (engH - 8) / 2, { lineBreak: false });
  doc.restore();
  for (let i = 0; i < 5; i++) circle(X + USABLE_W / 2 + 100 + i * 14, engMid);

  y += engH + mm(4);

  // ── TWEE KOLOMMEN: TIJDROOSTER | TAKEN VANDAAG ──────────
  const cW_L  = Math.round(USABLE_W * 0.48);
  const cW_R  = USABLE_W - cW_L - mm(3);
  const cX_R  = X + cW_L + mm(3);
  let yL = y, yR = y;

  // LEFT: Tijdrooster
  yL += sectionHdr('Tijdrooster', X, yL, cW_L, C.donkerblauw) + mm(2);

  const slots  = [...tijdblokken];
  while (slots.length < 8) slots.push(['__:__', '__:__', '']);

  const rowH  = mm(9);
  const tcW   = mm(17);

  slots.forEach((s, i) => {
    fillRect(X, yL, cW_L, rowH, i % 2 === 0 ? C.wit : C.lichtgrijs);
    strokeRect(X, yL, cW_L, rowH, C.midgrijs, 0.3);
    fillRect(X, yL, tcW, rowH, C.lichtgrijs);
    doc.save();
    doc.fillColor(C.grijs).font('Helvetica').fontSize(8);
    doc.text(String(s[0] || '__:__'), X + 2, yL + (rowH - 8) / 2,
      { lineBreak: false, width: tcW - 4, align: 'right' });
    doc.fillColor(C.zwart).font('Helvetica-Bold').fontSize(8);
    doc.text(String(s[2] || '').substring(0, 32),
      X + tcW + 4, yL + (rowH - 8) / 2,
      { lineBreak: false, width: cW_L - tcW - 6 });
    doc.restore();
    yL += rowH;
  });

  // RIGHT: Taken van vandaag
  yR += sectionHdr('Taken van vandaag', cX_R, yR, cW_R, C.middelblauw) + mm(2);

  const prioK = { hoog: C.rood, middel: '#d97706', laag: C.groen };

  taken_vandaag.forEach(t => {
    const prio  = String(t.prioriteit || 'middel').toLowerCase();
    const balk  = prioK[prio] || C.accentblauw;
    const subs  = Array.isArray(t.subtaken) ? t.subtaken.filter(s => typeof s === 'string') : [];
    const hasDet = !!(t.context || t.energie || t.tijd);
    const cardH  = mm(10) + (hasDet ? mm(4) : 0) + subs.length * mm(4.5) + mm(2);

    fillRect(cX_R, yR, cW_R, cardH, C.lichtgrijs, 3);
    fillRect(cX_R, yR, 3, cardH, balk, 2);
    checkbox(cX_R + 7, yR + 5);

    doc.save();
    doc.fillColor(C.zwart).font('Helvetica-Bold').fontSize(9);
    doc.text(String(t.titel || '').substring(0, 52),
      cX_R + 23, yR + 6, { lineBreak: false, width: cW_R - 28 });
    doc.restore();

    let ty = yR + 17;
    if (hasDet) {
      const parts = [];
      if (t.context) parts.push(String(t.context));
      if (t.energie) parts.push(`e: ${t.energie}`);
      if (t.tijd)    parts.push(`t: ${t.tijd}min`);
      doc.save();
      doc.fillColor(C.grijs).font('Helvetica').fontSize(7.5);
      doc.text(parts.join('  |  '), cX_R + 23, ty, { lineBreak: false, width: cW_R - 28 });
      doc.restore();
      ty += mm(4);
    }
    subs.forEach(sub => {
      doc.save();
      doc.fillColor(C.grijs).font('Helvetica').fontSize(7);
      doc.text('o ' + String(sub).substring(0, 42), cX_R + 28, ty,
        { lineBreak: false, width: cW_R - 34 });
      doc.restore();
      ty += mm(4.5);
    });
    yR += cardH + mm(2);
  });

  y = Math.max(yL, yR) + mm(4);

  // ── DEADLINE TAKEN ───────────────────────────────────────
  y += sectionHdr('Deadlines binnen 4 dagen  --  taken & subtaken', X, y, USABLE_W, C.rood) + mm(2);

  if (deadline_taken.length === 0) {
    doc.save();
    doc.fillColor(C.groen).font('Helvetica-Oblique').fontSize(9);
    doc.text('Geen urgente deadlines  --  goed bezig!', X + 8, y + 3, { lineBreak: false });
    doc.restore();
    y += mm(8);
  } else {
    const urgK   = { vandaag: C.rood,     morgen: '#d97706',    binnenkort: C.midgrijsD };
    const urgBg  = { vandaag: C.lichtrood, morgen: C.lichtoranje, binnenkort: C.midgrijs };
    const urgTc  = { vandaag: C.rood,     morgen: C.oranje,     binnenkort: C.midgrijsD };
    const urgLbl = { vandaag: 'VANDAAG',  morgen: 'MORGEN',     binnenkort: '< 4 DAGEN' };

    deadline_taken.forEach(t => {
      const urg    = String(t.urgentie || 'binnenkort');
      const subs   = Array.isArray(t.subtaken) ? t.subtaken : [];
      const hasDet = !!(t.detail || t.deadline_str);
      const cardH  = mm(10) + (hasDet ? mm(4) : 0) + subs.length * mm(4.5) + mm(2);
      const badgeW = mm(20);
      const badgeX = X + USABLE_W - badgeW - 4;

      fillRect(X, y, USABLE_W, cardH, C.lichtgrijs, 3);
      fillRect(X, y, 3, cardH, urgK[urg] || C.midgrijsD, 2);
      fillRect(badgeX, y + 3, badgeW, mm(5), urgBg[urg] || C.midgrijs, 2);

      doc.save();
      doc.fillColor(urgTc[urg] || C.grijs).font('Helvetica-Bold').fontSize(6.5);
      doc.text(urgLbl[urg] || '', badgeX, y + 4.5,
        { lineBreak: false, width: badgeW, align: 'center' });
      doc.restore();

      checkbox(X + 7, y + 5);

      doc.save();
      doc.fillColor(C.zwart).font('Helvetica-Bold').fontSize(9);
      doc.text(String(t.titel || '').substring(0, 60),
        X + 23, y + 6, { lineBreak: false, width: USABLE_W - badgeW - 30 });
      doc.restore();

      let ty = y + 17;
      const detail = t.detail || (t.deadline_str ? `Deadline: ${t.deadline_str}` : '');
      if (detail) {
        doc.save();
        doc.fillColor(C.grijs).font('Helvetica').fontSize(7.5);
        doc.text(String(detail), X + 23, ty, { lineBreak: false, width: USABLE_W - 28 });
        doc.restore();
        ty += mm(4);
      }
      subs.forEach(sub => {
        const tekst = String(sub.tekst || sub || '').substring(0, 60);
        const dl    = sub.deadline ? `  [${sub.deadline}]` : '';
        doc.save();
        doc.fillColor(sub.gedaan ? C.groen : C.grijs).font('Helvetica').fontSize(7);
        doc.text(`${sub.gedaan ? 'v' : 'o'} ${tekst}${dl}`, X + 28, ty,
          { lineBreak: false, width: USABLE_W - 34 });
        doc.restore();
        ty += mm(4.5);
      });
      y += cardH + mm(2);
    });
  }

  y += mm(3);

  // ── MORGEN ────────────────────────────────────────────────
  y += sectionHdr(`Morgen (${morgenStr(datum)})  --  vooruitblik`, X, y, USABLE_W, C.groen) + mm(2);

  if (taken_morgen.length === 0) {
    doc.save();
    doc.fillColor(C.grijs).font('Helvetica-Oblique').fontSize(9);
    doc.text('Nog geen taken gepland voor morgen.', X + 8, y + 3, { lineBreak: false });
    doc.restore();
    y += mm(8);
  } else {
    const rowHM = mm(9);
    taken_morgen.forEach((t, i) => {
      fillRect(X, y, USABLE_W, rowHM, i % 2 === 0 ? C.wit : C.lichtgrijs);
      strokeRect(X, y, USABLE_W, rowHM, C.midgrijs, 0.3);
      circle(X + 8, y + rowHM / 2, 4);
      doc.save();
      doc.fillColor(C.zwart).font('Helvetica-Bold').fontSize(9);
      doc.text(String(t.titel || ''), X + 18, y + (rowHM - 9) / 2,
        { lineBreak: false, width: USABLE_W * 0.5 });
      if (t.detail) {
        doc.fillColor(C.grijs).font('Helvetica').fontSize(8);
        doc.text(String(t.detail), X + 18 + USABLE_W * 0.52, y + (rowHM - 8) / 2,
          { lineBreak: false, width: USABLE_W * 0.28 });
      }
      if (t.deadline) {
        doc.fillColor(C.grijs).font('Helvetica').fontSize(8);
        doc.text(String(t.deadline), X + USABLE_W - 28, y + (rowHM - 8) / 2,
          { lineBreak: false, width: 26, align: 'right' });
      }
      doc.restore();
      y += rowHM;
    });
    y += mm(2);
  }

  y += mm(4);

  // ── NOTITIES RUIMTE ──────────────────────────────────────
  if (notities_ruimte) {
    y += sectionHdr('Notities & losse gedachten', X, y, USABLE_W, '#4b5563') + mm(2);
    for (let i = 0; i < 6; i++) {
      doc.save();
      doc.strokeColor(C.midgrijs).lineWidth(0.5);
      doc.moveTo(X, y + mm(8)).lineTo(X + USABLE_W, y + mm(8)).stroke();
      doc.restore();
      y += mm(9);
    }
    y += mm(3);
  }

  // ── DAGAFSLUITING ────────────────────────────────────────
  const afH  = mm(20);
  const afWL = Math.round(USABLE_W * 0.48);
  const afWR = USABLE_W - afWL - 2;
  const afXR = X + afWL + 2;

  fillRect(X, y, afWL, afH, C.lichtgrijs, 3);
  strokeRect(X, y, afWL, afH, C.midgrijs, 0.5, 3);
  doc.save();
  doc.fillColor(C.midgrijsD).font('Helvetica-Bold').fontSize(8);
  doc.text('Einde dag  --  terugblik', X + 8, y + 6, { lineBreak: false });
  doc.fillColor(C.grijs).font('Helvetica').fontSize(8);
  doc.text('Wat ging goed?  ____________________________________', X + 8, y + 18, { lineBreak: false });
  doc.text('Wat kan beter?  ___________________________________', X + 8, y + 30, { lineBreak: false });
  doc.restore();

  fillRect(afXR, y, afWR, afH, C.lichtblauw, 3);
  strokeRect(afXR, y, afWR, afH, C.accentblauw, 0.5, 3);
  doc.save();
  doc.fillColor(C.midgrijsD).font('Helvetica-Bold').fontSize(8);
  doc.text('Energie einde dag', afXR + 8, y + 6, { lineBreak: false });
  doc.restore();
  for (let i = 0; i < 5; i++) circle(afXR + 10 + i * 16, y + 18, 4.5);
  doc.save();
  const tvX = afXR + afWR / 2;
  doc.fillColor(C.midgrijsD).font('Helvetica-Bold').fontSize(8);
  doc.text('Taken voltooid', tvX, y + 6, { lineBreak: false });
  doc.fillColor(C.donkerblauw).font('Helvetica-Bold').fontSize(14);
  doc.text('___ / ___', tvX, y + 14, { lineBreak: false });
  doc.restore();

  y += afH + mm(3);

  // ── FOOTER ────────────────────────────────────────────────
  doc.save();
  doc.strokeColor(C.midgrijs).lineWidth(0.4);
  doc.moveTo(X, y).lineTo(X + USABLE_W, y).stroke();
  y += mm(2);
  doc.fillColor('#9ca3af').font('Helvetica').fontSize(7);
  doc.text(
    `GTD Dagplanner  |  ${fmtDatum(datum)}  |  "Je hoofd is er om ideeen te hebben, niet om ze te onthouden."`,
    X, y, { lineBreak: false, width: USABLE_W, align: 'center' }
  );
  doc.restore();

  doc.end();
}

module.exports = { genereerDagplanner };
