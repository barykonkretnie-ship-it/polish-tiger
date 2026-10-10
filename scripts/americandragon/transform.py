"""Turn parsed American Dragon pages into records for lib/americandragon.json.

Usage: python3 -I transform.py parsed.json lib/sample.ts lib/americandragon.json
Taste, temperature, channels and categories are mapped to the Polish vocabulary
already used by the atlas so filters cover old and imported records alike.
Actions, patterns, symptoms and indications stay in the source language (English).
"""
import json, re, sys, unicodedata
from datetime import date

TASTE = {'bitter': 'gorzki', 'acrid': 'ostry', 'pungent': 'ostry', 'sweet': 'słodki', 'salty': 'słony', 'sour': 'kwaśny',
         'astringent': 'cierpki', 'bland': 'mdły', 'aromatic': 'aromatyczny'}
THERMAL = [('very toxic', None), ('slightly toxic', None), ('toxic', None),
           ('slightly warm', 'lekko ciepłe'), ('mildly warm', 'lekko ciepłe'), ('slightly cold', 'lekko zimne'), ('mildly cold', 'lekko zimne'),
           ('hot', 'gorące'), ('warm', 'ciepłe'), ('neutral', 'neutralne'), ('cool', 'chłodne'), ('cold', 'zimne')]
TOXIC = {'very toxic': 'bardzo toksyczne (Very Toxic)', 'slightly toxic': 'lekko toksyczne (Slightly Toxic)', 'toxic': 'toksyczne (Toxic)'}
CHANNEL = {'liver': 'Wątroba', 'spleen': 'Śledziona', 'lung': 'Płuca', 'lungs': 'Płuca', 'heart': 'Serce', 'herat': 'Serce',
           'kidney': 'Nerki', 'kidneys': 'Nerki', 'stomach': 'Żołądek', 'large intestine': 'Jelito grube', 'small intestine': 'Jelito cienkie',
           'gallbladder': 'Pęcherzyk żółciowy', 'gall bladder': 'Pęcherzyk żółciowy', 'bladder': 'Pęcherz moczowy', 'urinary bladder': 'Pęcherz moczowy',
           'pericardium': 'Osierdzie', 'san jiao': 'Potrójny Ogrzewacz', 'triple burner': 'Potrójny Ogrzewacz'}
# Checked in order; the first keyword set fully contained in the category text wins.
CATEGORY = [(('invigorate', 'blood'), 'Poruszające Krew'), (('stop bleeding',), 'Tamujące krwawienie'),
            (('summerheat',), 'Oczyszczające Gorąco'), (('heat',), 'Oczyszczające Gorąco'),
            (('warm the interior',), 'Ogrzewające Wnętrze'), (('tonify', 'yin'), 'Tonizujące Yin'), (('tonify', 'yang'), 'Tonizujące Yang'),
            (('tonify', 'blood'), 'Odżywiające Krew'), (('tonify', 'qi'), 'Tonizujące Qi'), (('open the orifices',), 'Otwierające Otwory'),
            (('phlegm',), 'Transformujące Flegmę'), (('cough',), 'Transformujące Flegmę'), (('digestion',), 'Wspomagające trawienie'),
            (('downward',), 'Przeczyszczające'), (('cathartic',), 'Przeczyszczające'), (('aromatic', 'dampness'), 'Aromatyczne transformujące Wilgoć'),
            (('wind-dampness',), 'Usuwające Wiatr-Wilgoć'), (('drain dampness',), 'Usuwające Wilgoć'), (('stabilize',), 'Ściągające'),
            (('extinguish wind',), 'Wygaszające Wiatr'), (('calm the spirit',), 'Uspokajające Shen'), (('release the exterior',), 'Uwalniające Powierzchnię'),
            (('regulate qi',), 'Regulujące Qi'), (('topical',), 'Do stosowania zewnętrznego'), (('folk medicine',), 'Medycyna ludowa')]

def slug(name):
    name = re.sub(r'\(.*?\)|-.*$|[㐀-鿿]', '', name)
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

# Page titles the site got wrong; everything else uses the page title.
TITLE_FIXES = {'B Jiao Lian': 'Ba Jiao Lian', 'Resina Liquidamberis Taiwanianae': 'Bai Jiao Xiang'}

def tidy_name(name):
    name = re.sub(r'\s*-\s*[㐀-鿿].*$', '', name).strip()
    return TITLE_FIXES.get(name, name)

def primary(values):
    """Values not in parentheses; the site marks secondary properties with them."""
    return [v for v in values if not v.strip().startswith('(')]

def bare(v):
    return v.strip().strip('()').strip().lower()

def map_taste(values):
    out = []
    for v in primary(values):
        for key, label in TASTE.items():
            if key in bare(v) and label not in out:
                out.append(label)
    return out

def map_thermal(values):
    thermal, toxic = [], []
    for v in primary(values):
        b = bare(v)
        for key, label in THERMAL:
            if key in b:
                if label is None:
                    toxic.append(TOXIC[key])
                elif label not in thermal:
                    thermal.append(label)
                break
    return thermal, toxic

def map_channels(values):
    out = []
    for v in primary(values):
        label = CHANNEL.get(bare(v))
        if label and label not in out:
            out.append(label)
    return out

def map_category(values):
    text = ' '.join(values).lower().replace('clean', 'clear')
    main = text.split(':')[0] if ':' in text else text
    for scope in (text, main):
        for keys, label in CATEGORY:
            if all(k in scope for k in keys):
                return [label]
    return [' '.join(values)] if values else []

def bullets(title, items):
    items = [i for i in items if i]
    return f'{title}\n' + '\n'.join(f'• {i}' for i in items) if items else ''

def term_label(s):
    s = re.sub(r'\s+', ' ', s).strip().rstrip('.').strip()
    return s[:200]

HEADER = ('Zaimportowano z American Dragon (Dr Joel Penner), {url}, dnia {day}. Treść źródłowa w języku angielskim, '
          'niezweryfikowana merytorycznie. Nie jest to zalecenie leczenia; dawki pochodzą ze źródła i wymagają konsultacji z terapeutą.')

def herb_record(h, day):
    thermal, toxic = map_thermal(h['temperature'])
    actions = [term_label(a['action']) for a in h['actions'] if a['action']]
    notes = [HEADER.format(url=h['url'], day=day),
             f"Nazwa chińska: {h['chinese']}" if h['chinese'] else '',
             f"Kategoria (źródło): {' '.join(h['category'])}",
             f"Smak (źródło): {', '.join(h['taste'])}",
             f"Termika (źródło): {', '.join(h['temperature'])}",
             f"Kanały (źródło): {', '.join(h['channels'])}",
             f"Dawkowanie (źródło): {'; '.join(h['dosage'])}" if h['dosage'] else 'Dawkowanie: brak w źródle',
             'DZIAŁANIA I WSKAZANIA\n' + '\n'.join(f"• {a['action']}" + ''.join(f'\n   – {i}' for i in a['indications']) for a in h['actions']),
             bullets('PRZECIWWSKAZANIA', h['contraindications']),
             bullets('NIEZGODNOŚCI', h['incompatibilities']),
             bullets('INTERAKCJE ZIOŁO–LEK', h['interactions']),
             bullets('GŁÓWNE KOMBINACJE (układ tabeli źródłowej uproszczony)', h['combinations'])]
    return {
        'id': slug(tidy_name(h['name'])), 'kind': 'herb', 'name': tidy_name(h['name']), 'latin': h['latin'], 'translation': h['translation'],
        'notes': '\n\n'.join(n for n in notes if n), 'url': h['url'],
        'terms': {'category': map_category(h['category']), 'thermal': thermal, 'taste': map_taste(h['taste']),
                  'channel': map_channels(h['channels']), 'action': actions, 'contraindication': toxic},
    }

def formula_record(f, name, known, day):
    ingredients, missing = [], []
    for i in f['ingredients']:
        optional = i['pinyin'].strip().startswith('(')
        pid = slug(i['pinyin'])
        line = f"{i['pinyin']} ({i['latin']}) {i['dosage']}".strip()
        if pid in known:
            if pid not in [x['herb_id'] for x in ingredients]:
                ingredients.append({'herb_id': pid, 'quantity': i['dosage'] or 'brak danych',
                                    'role': 'składnik opcjonalny/wariant' if optional else 'składnik', 'preparation': i['latin'] or 'brak danych'})
        else:
            missing.append(line)
    notes = [HEADER.format(url=f['url'], day=day),
             f"Nazwa chińska: {f['chinese']}" if f['chinese'] else '',
             f"Nazwa na stronie źródłowej: {f['name']}" if f['name'] != name else '',
             bullets('INNE NAZWY', f['also_known_as']),
             'SKŁAD I DZIAŁANIA SKŁADNIKÓW (pełna lista ze źródła; nawiasy = wariant/opcja)\n' + '\n'.join(
                 f"• {i['pinyin']} — {i['latin']} — {i['dosage']}" + ''.join(f'\n   – {a}' for a in i['actions']) for i in f['ingredients']),
             bullets('SKŁADNIKI BEZ KARTY W ATLASIE', missing),
             bullets('OBJAWY KLINICZNE (T: język, C: nalot, P: puls)', f['manifestations']),
             bullets('PRZECIWWSKAZANIA', f['contraindications']),
             bullets('INTERAKCJE ZIOŁO–LEK', f['interactions']),
             bullets('UWAGI ŹRÓDŁA', f['notes']),
             bullets('MODYFIKACJE', f['modifications'])]
    return {
        'id': slug(name), 'kind': 'formula', 'name': name, 'latin': '', 'translation': f['translation'],
        'notes': '\n\n'.join(n for n in notes if n), 'url': f['url'], 'ingredients': ingredients,
        'terms': {'action': [term_label(a) for a in f['formula_actions']], 'pattern': [term_label(s) for s in f['syndromes']],
                  'symptom': [term_label(s) for s in f['manifestations'] if not re.match(r'^[TCP]:', s)],
                  'indication': [term_label(s) for s in f['treats']]},
    }

if __name__ == '__main__':
    parsed = json.load(open(sys.argv[1], encoding='utf-8'))
    sample_ids = set(re.findall(r"\[\s*'([a-z0-9-]+)','", open(sys.argv[2], encoding='utf-8').read()))
    names = json.load(open(sys.argv[4], encoding='utf-8')) if len(sys.argv) > 4 else {}
    day = date.today().isoformat()
    herbs = [herb_record(h, day) for h in parsed['herbs']]
    known = sample_ids | {h['id'] for h in herbs}
    formulas = [formula_record(f, names.get(f['url'], tidy_name(f['name'])), known, day) for f in parsed['formulas']]
    ids = [r['id'] for r in herbs + formulas]
    dupes = {i for i in ids if ids.count(i) > 1}
    assert not dupes, dupes
    out = {'source': parsed['source'], 'imported': day, 'herbs': herbs, 'formulas': formulas}
    open(sys.argv[3], 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print(len(herbs), 'herbs', len(formulas), 'formulas;', len(sample_ids & {h['id'] for h in herbs}), 'herbs merge into existing records')
