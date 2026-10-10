"""Parse downloaded American Dragon herb/formula pages into structured JSON."""
import json, re, sys, html as H
from pathlib import Path
from bs4 import BeautifulSoup

BASE = 'https://www.americandragon.com/'

def clean(s):
    s = H.unescape(s).replace('\xa0', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    # The site splits words with stray spaces inside styled spans ("r egulates", "Y ang").
    s = re.sub(r'\b([a-zA-Z]) (?=[a-z]{2,})', lambda m: m.group(1) if m.group(1) not in ('a', 'A', 'I') else m.group(0), s)
    s = re.sub(r'\s+([.,;:])', r'\1', s)
    return s

BLOCK = {'p', 'div', 'li', 'tr', 'td', 'th', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'blockquote', 'body'}

def lines(node):
    """Text lines split only at block elements and <br>, so inline spans stay in one line."""
    buf, out = [], []
    def flush():
        l = clean(''.join(buf)); buf.clear()
        if l:
            out.append(l)
    def walk(n):
        for c in n.children:
            name = getattr(c, 'name', None)
            if name is None:
                if type(c).__name__ in ('Comment', 'Doctype', 'Declaration', 'ProcessingInstruction'):
                    continue
                buf.append(str(c))
            elif name in ('script', 'style'):
                continue
            elif name == 'br':
                flush()
            elif name in BLOCK:
                flush(); walk(c); flush()
            else:
                walk(c)
    walk(node); flush()
    return out

def main_text(soup):
    """Plain text lines of the page body after the site navigation."""
    for t in soup(['script', 'style']):
        t.decompose()
    ls = lines(soup.body or soup)
    for marker in ('INDIVIDUAL HERBS', 'HERB FORMULAS'):
        if marker in ls:
            ls = ls[ls.index(marker) + 1:]
            break
    end = [i for i, l in enumerate(ls) if l.startswith('©') or 'American Dragon' in l and '©' in l]
    if end:
        ls = ls[:end[0]]
    return ls

def section(ls, start, stops):
    if start not in ls:
        return []
    i = ls.index(start) + 1
    out = []
    while i < len(ls) and ls[i] not in stops:
        out.append(ls[i]); i += 1
    return out

def cjk(s):
    m = re.search(r'[㐀-鿿]+', s)
    return m.group(0) if m else ''

def title_parts(soup):
    t = clean(soup.title.get_text()) if soup.title else ''
    parts = [p.strip() for p in t.split(' - ')]
    return parts

def parse_herb(path):
    soup = BeautifulSoup(path.read_text(encoding='utf-8', errors='replace'), 'lxml')
    parts = title_parts(soup)
    name = parts[0]
    ls = main_text(soup)
    def after(label):
        if label in ls:
            i = ls.index(label) + 1
            return ls[i] if i < len(ls) else ''
        return ''
    heads = {'CATEGORY', 'PROPERTIES', 'ACTIONS AND INDICATIONS', 'CONTRAINDICATIONS, INCOMPATIBILITIES AND HERB/DRUG INTERACTIONS',
             'CONTRAINDICATIONS', 'INCOMPATIBILITIES', 'HERB/DRUG INTERACTIONS', 'MAJOR COMBINATIONS:', 'MAJOR COMBINATIONS', 'NOTES', 'PREPARATION', 'FORMULAS'}
    english = section(ls, 'Common English:', heads)
    rec = {
        'kind': 'herb', 'name': name, 'chinese': cjk(' '.join(parts)),
        'latin': after('Pharmaceutical Latin:'), 'translation': ', '.join(english),
        'category': section(ls, 'CATEGORY', heads),
    }
    # Properties table: header row then one row of cells (taste, temperature, channels, dosage).
    props = {'taste': [], 'temperature': [], 'channels': [], 'dosage': []}
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if len(rows) >= 2 and 'Entering Meridians' in table.get_text():
            cells = rows[1].find_all('td')
            for key, cell in zip(props, cells):
                props[key] = lines(cell)
            break
    rec.update(props)
    # Actions table: each row pairs an action with its indications.
    actions = []
    for table in soup.find_all('table'):
        txt = table.get_text()
        if 'Indications/Syndromes' in txt and 'Actions' in txt:
            for row in table.find_all('tr')[1:]:
                cells = row.find_all('td')
                if len(cells) >= 2:
                    a = ' '.join(lines(cells[0])); ind = lines(cells[1])
                    if a or ind:
                        actions.append({'action': a, 'indications': ind})
            break
    rec['actions'] = actions
    stops = heads
    rec['contraindications'] = section(ls, 'CONTRAINDICATIONS', stops)
    rec['incompatibilities'] = section(ls, 'INCOMPATIBILITIES', stops)
    rec['interactions'] = section(ls, 'HERB/DRUG INTERACTIONS', stops)
    combo_start = 'MAJOR COMBINATIONS:' if 'MAJOR COMBINATIONS:' in ls else 'MAJOR COMBINATIONS'
    rec['combinations'] = ls[ls.index(combo_start) + 1:] if combo_start in ls else []
    rec['full_text'] = ls
    return rec

def parse_formula(path):
    soup = BeautifulSoup(path.read_text(encoding='utf-8', errors='replace'), 'lxml')
    parts = title_parts(soup)
    ls = main_text(soup)
    if ls and ls[0].lower().startswith('back to'):
        ls = ls[1:]
    heads = {'HERBS AND ACTIONS', 'FORMULA ACTIONS', 'SYNDROMES', 'CLINICAL MANIFESTATIONS', 'TREATS',
             'CONTRAINDICATIONS AND HERB/DRUG INTERACTIONS', 'CONTRAINDICATIONS', 'HERB/DRUG INTERACTIONS', 'NOTES', 'MODIFICATIONS', 'Also Known As:', 'English:'}
    name = parts[0]
    english = section(ls, 'English:', heads)
    ingredients = []
    for table in soup.find_all('table'):
        txt = table.get_text()
        if 'Pharmaceutical Latin' in txt and 'Pin Yin' in txt and 'Dosage' in txt:
            for row in table.find_all('tr')[1:]:
                cells = row.find_all('td')
                if len(cells) >= 3:
                    latin = ' '.join(lines(cells[0])); pinyin = ' '.join(lines(cells[1]))
                    if not pinyin and not latin:
                        continue
                    ingredients.append({'latin': latin, 'pinyin': pinyin, 'dosage': ' '.join(lines(cells[2])),
                                        'actions': lines(cells[3]) if len(cells) > 3 else []})
            break
    return {
        'kind': 'formula', 'name': name, 'chinese': cjk(' '.join(parts)), 'translation': ', '.join(english),
        'also_known_as': section(ls, 'Also Known As:', heads), 'ingredients': ingredients,
        'formula_actions': section(ls, 'FORMULA ACTIONS', heads), 'syndromes': section(ls, 'SYNDROMES', heads),
        'manifestations': section(ls, 'CLINICAL MANIFESTATIONS', heads), 'treats': section(ls, 'TREATS', heads),
        'contraindications': section(ls, 'CONTRAINDICATIONS', heads), 'interactions': section(ls, 'HERB/DRUG INTERACTIONS', heads),
        'notes': section(ls, 'NOTES', heads), 'modifications': section(ls, 'MODIFICATIONS', heads), 'full_text': ls,
    }

if __name__ == '__main__':
    root = Path(sys.argv[1]); out = Path(sys.argv[2])
    herb_order = [l.strip() for l in (root / 'herb_paths.txt').read_text().splitlines() if l.strip()]
    formula_order = [l.strip() for l in (root / 'formula50.txt').read_text().splitlines() if l.strip()]
    data = {'source': BASE, 'herbs': [], 'formulas': []}
    for rel in herb_order:
        r = parse_herb(root / 'herbs' / Path(rel).name); r['url'] = BASE + rel.replace(' ', '%20'); data['herbs'].append(r)
    for f in formula_order:
        p = root / 'formulas' / f
        if not p.exists():
            continue
        r = parse_formula(p); r['url'] = BASE + 'Herb%20Formulas%20copy/' + f; data['formulas'].append(r)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(len(data['herbs']), 'herbs', len(data['formulas']), 'formulas')
