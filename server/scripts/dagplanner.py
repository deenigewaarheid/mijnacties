"""
GTD Dagplanner PDF Generator
Gebruik: python dagplanner.py output.pdf          (DB-modus, haalt data live op)
         python dagplanner.py input.json output.pdf (JSON-modus)
         python dagplanner.py                       (demo-modus)
"""

import json
import sys
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import Flowable
from datetime import date, timedelta

try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_BESCHIKBAAR = True
except ImportError:
    PSYCOPG2_BESCHIKBAAR = False

# ============================================================
# KLEUREN
# ============================================================
DONKERBLAUW       = colors.HexColor('#1e3a5f')
MIDDELBLAUW       = colors.HexColor('#2d6a9f')
LICHTBLAUW        = colors.HexColor('#dbeafe')
ACCENTBLAUW       = colors.HexColor('#3b82f6')
GROEN             = colors.HexColor('#166534')
LICHTGROEN        = colors.HexColor('#dcfce7')
ROOD              = colors.HexColor('#991b1b')
LICHTROOD         = colors.HexColor('#fee2e2')
ORANJE            = colors.HexColor('#92400e')
LICHTORANJE       = colors.HexColor('#fef3c7')
GRIJS             = colors.HexColor('#374151')
LICHTGRIJS        = colors.HexColor('#f9fafb')
MIDGRIJS          = colors.HexColor('#e5e7eb')
MIDDENGRIJS_DONKER= colors.HexColor('#6b7280')
WIT               = colors.white
ZWART             = colors.HexColor('#111827')

# ============================================================
# DATABASE
# ============================================================
def _db_verbinding():
    """Maak verbinding via env-variabelen of .env bestand."""
    # Laad .env als psycopg2 beschikbaar is
    env_pad = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_pad):
        with open(env_pad, encoding='utf-8') as f:
            for regel in f:
                regel = regel.strip()
                if regel and not regel.startswith('#') and '=' in regel:
                    sleutel, _, waarde = regel.partition('=')
                    os.environ.setdefault(sleutel.strip(), waarde.strip().strip('"').strip("'"))

    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        port=int(os.environ.get('DB_PORT', 5432)),
        dbname=os.environ.get('DB_NAME', os.environ.get('DB_DATABASE', 'mailanalyzer')),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', ''),
    )


def haal_taken_vandaag(cur, user_id):
    cur.execute("""
        SELECT t.id, t.title, t.priority, t.context, t.energie, t.tijd_minuten
          FROM tasks t
         WHERE t.user_id = %s AND t.completed = false
           AND DATE(t.deadline) = CURRENT_DATE
         ORDER BY t.deadline
    """, (user_id,))
    taken = []
    for rij in cur.fetchall():
        cur.execute("""
            SELECT text FROM subtasks WHERE task_id = %s AND completed = false
        """, (rij['id'],))
        subs = [r['text'] for r in cur.fetchall()]
        PRIO = {'high': 'Hoog', 'mid': 'Middel', 'low': 'Laag'}
        taken.append({
            'titel':      rij['title'],
            'prioriteit': PRIO.get(rij['priority'], 'Middel'),
            'context':    rij['context'] or '',
            'energie':    rij['energie'] or '',
            'tijd':       rij['tijd_minuten'] or '',
            'subtaken':   subs,
        })
    return taken


def haal_deadline_taken(cur, user_id):
    cur.execute("""
        SELECT t.id, t.title, t.deadline
          FROM tasks t
         WHERE t.user_id = %s AND t.completed = false
           AND t.deadline IS NOT NULL
           AND DATE(t.deadline) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '4 days'
         ORDER BY t.deadline
    """, (user_id,))
    taken = []
    for rij in cur.fetchall():
        dl_str = rij['deadline'].strftime('%Y-%m-%d')
        d = date.fromisoformat(dl_str)
        dagen = (d - date.today()).days
        urgentie = 'vandaag' if dagen <= 0 else 'morgen' if dagen == 1 else 'binnenkort'
        maanden = ['','januari','februari','maart','april','mei','juni',
                   'juli','augustus','september','oktober','november','december']
        deadline_leesbaar = f"{d.day} {maanden[d.month]}"

        cur.execute("""
            SELECT text, completed FROM subtasks WHERE task_id = %s
        """, (rij['id'],))
        subs = [{'tekst': r['text'], 'gedaan': r['completed']} for r in cur.fetchall()]

        taken.append({
            'titel':        rij['title'],
            'deadline_str': deadline_leesbaar,
            'urgentie':     urgentie,
            'subtaken':     subs,
        })
    return taken


def haal_taken_morgen(cur, user_id):
    cur.execute("""
        SELECT title, context, category
          FROM tasks
         WHERE user_id = %s AND completed = false
           AND DATE(deadline) = CURRENT_DATE + INTERVAL '1 day'
         ORDER BY deadline
    """, (user_id,))
    return [{'titel': r['title'], 'detail': r['context'] or r['category'] or ''}
            for r in cur.fetchall()]


def haal_tijdblokken(cur, user_id):
    """Geeft tijdblokken terug als lijst van (start, eind, taak) tuples.
    Retourneert lege lijst als de tabel niet bestaat."""
    try:
        cur.execute("""
            SELECT start_tijd, eind_tijd, omschrijving
              FROM tijdblokken
             WHERE user_id = %s AND DATE(datum) = CURRENT_DATE
             ORDER BY start_tijd
        """, (user_id,))
        return [(r['start_tijd'].strftime('%H:%M'), r['eind_tijd'].strftime('%H:%M'),
                 r['omschrijving']) for r in cur.fetchall()]
    except psycopg2.errors.UndefinedTable:
        cur.connection.rollback()
        return []


def laad_uit_database(user_id=None):
    """Haalt alle dagplanner-data op uit de database."""
    if not PSYCOPG2_BESCHIKBAAR:
        raise RuntimeError('psycopg2 niet geïnstalleerd. Voer: pip install psycopg2-binary')

    conn = _db_verbinding()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Gebruik eerste gebruiker als geen user_id opgegeven
            if user_id is None:
                cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
                rij = cur.fetchone()
                if not rij:
                    raise RuntimeError('Geen gebruikers gevonden in de database.')
                user_id = rij['id']

            return {
                'datum':          date.today().isoformat(),
                'taken_vandaag':  haal_taken_vandaag(cur, user_id),
                'deadline_taken': haal_deadline_taken(cur, user_id),
                'taken_morgen':   haal_taken_morgen(cur, user_id),
                'tijdblokken':    haal_tijdblokken(cur, user_id),
            }
    finally:
        conn.close()


# ============================================================
# STIJLEN
# ============================================================
def maak_stijlen():
    return {
        'koptitel': ParagraphStyle('koptitel',
            fontName='Helvetica-Bold', fontSize=20,
            textColor=WIT, alignment=TA_LEFT, leading=24),
        'kopsubtitel': ParagraphStyle('kopsubtitel',
            fontName='Helvetica', fontSize=10,
            textColor=colors.HexColor('#bfdbfe'),
            alignment=TA_LEFT, leading=14),
        'koprechts': ParagraphStyle('koprechts',
            fontName='Helvetica-Bold', fontSize=14,
            textColor=WIT, alignment=TA_RIGHT, leading=18),
        'sectietitel': ParagraphStyle('sectietitel',
            fontName='Helvetica-Bold', fontSize=12,
            textColor=WIT, alignment=TA_LEFT, leading=15),
        'taaktitel': ParagraphStyle('taaktitel',
            fontName='Helvetica-Bold', fontSize=11,
            textColor=ZWART, leading=14),
        'taakdetail': ParagraphStyle('taakdetail',
            fontName='Helvetica', fontSize=10,
            textColor=GRIJS, leading=13),
        'subtaak': ParagraphStyle('subtaak',
            fontName='Helvetica', fontSize=10,
            textColor=GRIJS, leading=13, leftIndent=10),
        'label': ParagraphStyle('label',
            fontName='Helvetica-Bold', fontSize=7,
            textColor=MIDDENGRIJS_DONKER, leading=10),
        'notitie': ParagraphStyle('notitie',
            fontName='Helvetica-Oblique', fontSize=8,
            textColor=GRIJS, leading=11),
        'tijdlabel': ParagraphStyle('tijdlabel',
            fontName='Helvetica', fontSize=10,
            textColor=GRIJS, alignment=TA_RIGHT, leading=13),
        'klein': ParagraphStyle('klein',
            fontName='Helvetica', fontSize=7,
            textColor=GRIJS, leading=10),
        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=7,
            textColor=colors.HexColor('#9ca3af'),
            alignment=TA_CENTER, leading=10),
    }

# ============================================================
# CUSTOM FLOWABLE: CHECKBOX ROW
# ============================================================
class CheckboxRow(Flowable):
    def __init__(self, tekst, detail='', subtaken=None,
                 kleur_balk=ACCENTBLAUW, urgentie=None, hoogte=None):
        Flowable.__init__(self)
        self.tekst    = tekst
        self.detail   = detail
        self.subtaken = subtaken or []
        self.kleur_balk = kleur_balk
        self.urgentie = urgentie
        subtaak_hoogte = len(self.subtaken) * 13
        self.hoogte = hoogte or (44 + subtaak_hoogte + (10 if detail else 0))
        self.width = 0

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        return (avail_width, self.hoogte)

    def draw(self):
        c = self.canv
        w = self.width
        h = self.hoogte

        c.setFillColor(LICHTGRIJS)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)

        c.setFillColor(self.kleur_balk)
        c.roundRect(0, 0, 4, h, 2, fill=1, stroke=0)

        if self.urgentie:
            urg_colors = {
                'vandaag':    (ROOD,              LICHTROOD),
                'morgen':     (ORANJE,            LICHTORANJE),
                'binnenkort': (MIDDENGRIJS_DONKER, MIDGRIJS),
            }
            tc, bc = urg_colors.get(self.urgentie, (GRIJS, LICHTGRIJS))
            badge_w = 52
            badge_x = w - badge_w - 6
            badge_y = h - 16
            c.setFillColor(bc)
            c.roundRect(badge_x, badge_y, badge_w, 12, 3, fill=1, stroke=0)
            c.setFillColor(tc)
            c.setFont('Helvetica-Bold', 6.5)
            labels = {'vandaag': 'VANDAAG', 'morgen': 'MORGEN', 'binnenkort': '< 4 DAGEN'}
            c.drawCentredString(badge_x + badge_w / 2, badge_y + 3.5,
                                labels.get(self.urgentie, ''))

        box_x, box_y = 12, h - 24
        c.setStrokeColor(MIDDENGRIJS_DONKER)
        c.setLineWidth(1.2)
        c.setFillColor(WIT)
        c.roundRect(box_x, box_y, 13, 13, 2, fill=1, stroke=1)

        c.setFillColor(ZWART)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(30, h - 18, self.tekst[:70])

        if self.detail:
            c.setFillColor(GRIJS)
            c.setFont('Helvetica', 9)
            c.drawString(30, h - 30, self.detail[:90])

        y_sub = h - 30 - (12 if self.detail else 2)
        for sub in self.subtaken:
            done, tekst = sub
            c.setFillColor(GROEN if done else GRIJS)
            c.setFont('Helvetica', 9)
            prefix = '✓ ' if done else '○ '
            c.drawString(36, y_sub, prefix + tekst[:80])
            y_sub -= 13


# ============================================================
# HELPERS
# ============================================================
def sectieheader(tekst, kleur=DONKERBLAUW, breedte=None):
    data = [[Paragraph(f'<b>{tekst}</b>',
                       ParagraphStyle('sh', fontName='Helvetica-Bold',
                                      fontSize=12, textColor=WIT, leading=15))]]
    stijl = TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), kleur),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
    ])
    return Table(data, colWidths=[breedte or 165 * mm], style=stijl)


def maak_tijdrooster(tijdblokken):
    stijlen = maak_stijlen()
    rijen = []
    for start, eind, taak in tijdblokken:
        rijen.append([
            Paragraph(f'{start}<br/>{eind}', stijlen['tijdlabel']),
            Paragraph(taak, stijlen['taaktitel']),
            Paragraph('', stijlen['klein']),
        ])
    while len(rijen) < 8:
        rijen.append([
            Paragraph('__:__', stijlen['tijdlabel']),
            Paragraph('', stijlen['klein']),
            Paragraph('', stijlen['klein']),
        ])
    tabel = Table(rijen, colWidths=[18 * mm, 80 * mm, 65 * mm],
                  rowHeights=[18 * mm] * len(rijen))
    tabel.setStyle(TableStyle([
        ('GRID',            (0, 0), (-1, -1), 0.4,  MIDGRIJS),
        ('LINEBELOW',       (0, 0), (-1, -1), 0.8,  MIDGRIJS),
        ('BACKGROUND',      (0, 0), (0,  -1), LICHTGRIJS),
        ('VALIGN',          (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING',      (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING',   (0, 0), (-1, -1), 6),
        ('LEFTPADDING',     (0, 0), (-1, -1), 6),
        ('RIGHTPADDING',    (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS',  (0, 0), (-1, -1), [WIT, LICHTGRIJS]),
    ]))
    return tabel


def energiemeter():
    data = [[
        Paragraph('<b>Energie ochtend</b>',
                  ParagraphStyle('em', fontName='Helvetica-Bold', fontSize=8, textColor=GRIJS, leading=10)),
        Paragraph('○ ○ ○ ○ ○',
                  ParagraphStyle('em2', fontName='Helvetica', fontSize=11, textColor=ACCENTBLAUW, leading=13)),
        Paragraph('<b>Energie middag</b>',
                  ParagraphStyle('em', fontName='Helvetica-Bold', fontSize=8, textColor=GRIJS, leading=10)),
        Paragraph('○ ○ ○ ○ ○',
                  ParagraphStyle('em2', fontName='Helvetica', fontSize=11, textColor=ACCENTBLAUW, leading=13)),
    ]]
    t = Table(data, colWidths=[35 * mm, 47 * mm, 35 * mm, 47 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), LICHTBLAUW),
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('BOX',           (0, 0), (-1, -1), 0.5, ACCENTBLAUW),
    ]))
    return t


# ============================================================
# HOOFD GENERATOR
# ============================================================
def genereer_dagplanner(
    datum,
    taken_vandaag,
    taken_morgen,
    deadline_taken,
    tijdblokken,
    intentie_dag='',
    drie_winsten=None,
    notities_ruimte=True,
    output_pad='dagplanner.pdf',
):
    doc = SimpleDocTemplate(
        output_pad,
        pagesize=A4,
        topMargin=12 * mm, bottomMargin=12 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )
    stijlen = maak_stijlen()
    content = []

    dag_nl   = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
    maand_nl = ['','januari','februari','maart','april','mei','juni',
                'juli','augustus','september','oktober','november','december']
    morgen = datum + timedelta(days=1)
    dag_naam  = dag_nl[datum.weekday()]
    datum_str = f"{datum.day} {maand_nl[datum.month]} {datum.year}"
    morgen_str = f"{morgen.day} {maand_nl[morgen.month]}"

    # ── HEADER ──────────────────────────────────────────────
    header_data = [[
        Table([[
            Paragraph(f'Dagplanner — <b>{dag_naam}</b>', stijlen['koptitel']),
            Paragraph(f'{datum_str}  ·  GTD Productiviteitssysteem', stijlen['kopsubtitel']),
        ]], colWidths=[120 * mm]),
        Table([[
            Paragraph(f'Morgen: {morgen_str}', stijlen['koprechts']),
            Paragraph(f'{len(taken_vandaag)} taken  ·  {len(deadline_taken)} deadlines',
                      stijlen['kopsubtitel']),
        ]], colWidths=[47 * mm]),
    ]]
    header_tabel = Table(header_data, colWidths=[120 * mm, 47 * mm])
    header_tabel.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), DONKERBLAUW),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING',   (0, 0), (-1, -1), 12),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    content.append(header_tabel)
    content.append(Spacer(1, 4 * mm))

    # ── INTENTIE + 3 WINSTEN ────────────────────────────────
    intentie_data = [[
        Table([[
            Paragraph('<b>Intentie van de dag</b>',
                      ParagraphStyle('il', fontName='Helvetica-Bold', fontSize=8,
                                     textColor=MIDDENGRIJS_DONKER, leading=10)),
            Paragraph(intentie_dag or '_' * 60,
                      ParagraphStyle('iv', fontName='Helvetica-Bold', fontSize=11,
                                     textColor=DONKERBLAUW, leading=14)),
        ]], colWidths=[110 * mm]),
        Table([[
            Paragraph('<b>3 winsten van vandaag</b>',
                      ParagraphStyle('wl', fontName='Helvetica-Bold', fontSize=8,
                                     textColor=MIDDENGRIJS_DONKER, leading=10)),
            *[Paragraph(
                f'{i+1}. {w}' if drie_winsten and i < len(drie_winsten) else f'{i+1}. ___________________________',
                ParagraphStyle('wv', fontName='Helvetica', fontSize=10, textColor=ZWART, leading=13))
              for i, w in enumerate((drie_winsten or []) + [''] * 3)]
        ]], colWidths=[53 * mm]),
    ]]
    int_tabel = Table(intentie_data, colWidths=[113 * mm, 54 * mm])
    int_tabel.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (0, 0), LICHTBLAUW),
        ('BACKGROUND',    (1, 0), (1, 0), LICHTGROEN),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('BOX',           (0, 0), (0,  0),  0.5, ACCENTBLAUW),
        ('BOX',           (1, 0), (1,  0),  0.5, colors.HexColor('#86efac')),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    content.append(int_tabel)
    content.append(Spacer(1, 4 * mm))

    # ── ENERGIE METER ────────────────────────────────────────
    content.append(energiemeter())
    content.append(Spacer(1, 4 * mm))

    # ── TWEE KOLOMMEN: TIJDROOSTER | TAKEN VANDAAG ──────────
    prio_kleuren = {
        'hoog':   ROOD,
        'middel': colors.HexColor('#d97706'),
        'laag':   GROEN,
    }

    linker = [sectieheader('⏱  Tijdrooster', DONKERBLAUW, 80 * mm), Spacer(1, 2 * mm),
              maak_tijdrooster(tijdblokken)]

    rechter = [sectieheader('✓  Taken van vandaag', MIDDELBLAUW, 82 * mm), Spacer(1, 2 * mm)]
    for t in taken_vandaag:
        prio   = str(t.get('prioriteit', 'middel')).lower()
        kleur  = prio_kleuren.get(prio, ACCENTBLAUW)
        subs   = [(False, s) for s in t.get('subtaken', [])]
        parts  = []
        if t.get('context'):  parts.append(t['context'])
        if t.get('energie'):  parts.append(f"⚡ {t['energie']}")
        if t.get('tijd'):     parts.append(f"⏱ {t['tijd']}min")
        rechter.append(CheckboxRow(tekst=t['titel'], detail='  ·  '.join(parts),
                                   subtaken=subs, kleur_balk=kleur))
        rechter.append(Spacer(1, 2 * mm))

    linker_tabel  = Table([[f] for f in linker],  colWidths=[83 * mm])
    rechter_tabel = Table([[f] for f in rechter], colWidths=[82 * mm])
    for tbl in (linker_tabel, rechter_tabel):
        tbl.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),2)]))

    twee_kolommen = Table([[linker_tabel, rechter_tabel]], colWidths=[85 * mm, 82 * mm])
    twee_kolommen.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
    ]))
    content.append(twee_kolommen)
    content.append(Spacer(1, 5 * mm))

    # ── DEADLINE TAKEN ───────────────────────────────────────
    content.append(sectieheader('⚠  Deadlines binnen 4 dagen — taken & subtaken', ROOD))
    content.append(Spacer(1, 2 * mm))
    urg_kleuren = {'vandaag': ROOD, 'morgen': colors.HexColor('#d97706'), 'binnenkort': MIDDENGRIJS_DONKER}
    if deadline_taken:
        for t in deadline_taken:
            urg   = t.get('urgentie', 'binnenkort')
            kleur = urg_kleuren.get(urg, MIDDENGRIJS_DONKER)
            subs  = [(s.get('gedaan', False), s['tekst']) for s in t.get('subtaken', [])]
            hoogte = 38 + len(subs) * 12
            content.append(CheckboxRow(
                tekst=t['titel'],
                detail=f"Deadline: {t.get('deadline_str', '')}",
                subtaken=subs, kleur_balk=kleur, urgentie=urg, hoogte=hoogte,
            ))
            content.append(Spacer(1, 2 * mm))
    else:
        content.append(Paragraph('Geen urgente deadlines — goed bezig!',
                                  ParagraphStyle('goed', fontName='Helvetica-Oblique',
                                                 fontSize=9, textColor=GROEN, leading=12)))
        content.append(Spacer(1, 3 * mm))

    content.append(Spacer(1, 3 * mm))

    # ── MORGEN ────────────────────────────────────────────────
    content.append(sectieheader(f'→  Morgen ({morgen_str}) — vooruitblik', GROEN))
    content.append(Spacer(1, 2 * mm))
    if taken_morgen:
        morgen_rijen = [[
            Paragraph('○', ParagraphStyle('cb', fontName='Helvetica', fontSize=12,
                                           textColor=ACCENTBLAUW, leading=14)),
            Paragraph(t['titel'], stijlen['taaktitel']),
            Paragraph(t.get('detail', ''), stijlen['taakdetail']),
            Paragraph(t.get('deadline', ''), stijlen['tijdlabel']),
        ] for t in taken_morgen]
        morgen_tabel = Table(morgen_rijen, colWidths=[8 * mm, 85 * mm, 55 * mm, 19 * mm])
        morgen_tabel.setStyle(TableStyle([
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [WIT, LICHTGRIJS]),
            ('TOPPADDING',     (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING',  (0, 0), (-1, -1), 5),
            ('LEFTPADDING',    (0, 0), (-1, -1), 6),
            ('GRID',           (0, 0), (-1, -1), 0.3, MIDGRIJS),
            ('VALIGN',         (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        content.append(morgen_tabel)
    else:
        content.append(Paragraph('Nog geen taken gepland voor morgen.',
                                  ParagraphStyle('leeg', fontName='Helvetica-Oblique',
                                                 fontSize=9, textColor=GRIJS, leading=12)))

    content.append(Spacer(1, 4 * mm))

    # ── NOTITIES RUIMTE ──────────────────────────────────────
    if notities_ruimte:
        content.append(sectieheader('✏  Notities & losse gedachten', colors.HexColor('#4b5563')))
        content.append(Spacer(1, 2 * mm))
        lijn_data  = [[Paragraph('', stijlen['klein'])] for _ in range(6)]
        lijn_tabel = Table(lijn_data, colWidths=[167 * mm], rowHeights=[9 * mm] * 6)
        lijn_tabel.setStyle(TableStyle([
            ('LINEBELOW',     (0, 0), (-1, -1), 0.5, MIDGRIJS),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        content.append(lijn_tabel)
        content.append(Spacer(1, 3 * mm))

    # ── DAGAFSLUITING ────────────────────────────────────────
    afsluiting_data = [[
        Table([[
            Paragraph('<b>Einde dag — terugblik</b>',
                      ParagraphStyle('atl', fontName='Helvetica-Bold', fontSize=8, textColor=MIDDENGRIJS_DONKER)),
            Paragraph('Wat ging goed?  ____________________________________',
                      ParagraphStyle('av', fontName='Helvetica', fontSize=8, textColor=GRIJS, leading=12)),
            Paragraph('Wat kan beter?  ___________________________________',
                      ParagraphStyle('av2', fontName='Helvetica', fontSize=8, textColor=GRIJS, leading=12)),
        ]], colWidths=[80 * mm]),
        Table([[
            Paragraph('<b>Energie einde dag</b>',
                      ParagraphStyle('eel', fontName='Helvetica-Bold', fontSize=8, textColor=MIDDENGRIJS_DONKER)),
            Paragraph('○  ○  ○  ○  ○',
                      ParagraphStyle('eev', fontName='Helvetica', fontSize=11, textColor=ACCENTBLAUW, leading=14)),
            Paragraph('<b>Taken voltooid</b>',
                      ParagraphStyle('tvl', fontName='Helvetica-Bold', fontSize=8, textColor=MIDDENGRIJS_DONKER)),
            Paragraph('___ / ___',
                      ParagraphStyle('tvv', fontName='Helvetica-Bold', fontSize=14, textColor=DONKERBLAUW, leading=16)),
        ]], colWidths=[84 * mm]),
    ]]
    afsluiting_tabel = Table(afsluiting_data, colWidths=[82 * mm, 85 * mm])
    afsluiting_tabel.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (0, 0), LICHTGRIJS),
        ('BACKGROUND',    (1, 0), (1, 0), LICHTBLAUW),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('BOX',           (0, 0), (0,  0),  0.5, MIDGRIJS),
        ('BOX',           (1, 0), (1,  0),  0.5, ACCENTBLAUW),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    content.append(afsluiting_tabel)
    content.append(Spacer(1, 3 * mm))

    # ── FOOTER ────────────────────────────────────────────────
    content.append(HRFlowable(width='100%', thickness=0.4, color=MIDGRIJS))
    content.append(Spacer(1, 1 * mm))
    content.append(Paragraph(
        f'GTD Dagplanner  ·  {datum_str}  ·  "Je hoofd is er om ideeën te hebben, niet om ze te onthouden."',
        stijlen['footer'],
    ))

    doc.build(content)
    print(f'✅ Dagplanner gegenereerd: {output_pad}', file=sys.stderr)


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == '__main__':
    if len(sys.argv) == 3:
        # JSON-modus: dagplanner.py input.json output.pdf
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            d = json.load(f)

        datum       = date.fromisoformat(d['datum'])
        tijdblokken = [tuple(t) for t in d.get('tijdblokken', [])]

        genereer_dagplanner(
            datum=datum,
            taken_vandaag=d.get('taken_vandaag', []),
            taken_morgen=d.get('taken_morgen', []),
            deadline_taken=d.get('deadline_taken', []),
            tijdblokken=tijdblokken,
            intentie_dag=d.get('intentie_dag', ''),
            drie_winsten=d.get('drie_winsten'),
            notities_ruimte=d.get('notities_ruimte', True),
            output_pad=sys.argv[2],
        )

    elif len(sys.argv) == 2 and not sys.argv[1].endswith('.json'):
        # DB-modus: dagplanner.py output.pdf
        output_pad = sys.argv[1]
        user_id = os.environ.get('DAGPLANNER_USER_ID')
        if user_id:
            user_id = int(user_id)
        d = laad_uit_database(user_id)
        datum = date.fromisoformat(d['datum'])
        genereer_dagplanner(
            datum=datum,
            taken_vandaag=d['taken_vandaag'],
            taken_morgen=d['taken_morgen'],
            deadline_taken=d['deadline_taken'],
            tijdblokken=d['tijdblokken'],
            output_pad=output_pad,
        )

    else:
        # Demo-modus
        vandaag = date.today()
        genereer_dagplanner(
            datum=vandaag,
            taken_vandaag=[
                {'titel': 'Nakijken toetsen 4e klas', 'context': '@school',
                 'energie': 'hoog', 'tijd': 45, 'prioriteit': 'hoog',
                 'subtaken': ['Toetsen ophalen', 'Nakijken', 'Cijfers invoeren']},
                {'titel': 'PTO 2026-2027 aanpassen', 'context': '@computer',
                 'energie': 'middel', 'tijd': 30, 'prioriteit': 'hoog', 'subtaken': []},
            ],
            taken_morgen=[
                {'titel': 'Teamtijd bijwonen (15:30)', 'detail': 'Kalender', 'deadline': '15:30'},
            ],
            deadline_taken=[],
            tijdblokken=[
                ('08:00', '09:00', 'Inbox verwerken'),
                ('09:00', '10:00', 'Nakijken toetsen'),
            ],
            intentie_dag='Focus op nakijken en PTO afronden.',
            output_pad='dagplanner_demo.pdf',
        )
