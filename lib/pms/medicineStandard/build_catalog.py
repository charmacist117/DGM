
"""Build searchable ingredient records while retaining source text and table cells."""
import json
import re
import sys
import unicodedata
from pathlib import Path
from extract_annex import extract

# Table indexes are one-based within the extracted chapter, including in-text tables.
# Limits describe the basis, source column and default unit.
def d(col, unit='mg'): return ('day', col, unit)
def s(col, unit='mg'): return ('single', col, unit)
def c(col): return ('conc', col, '%')
def h(col): return ('herb', col, 'g')
def p(col): return ('powder', col, 'g')
def m(col, unit='mg'): return ('minimum', col, unit)

CONFIG = {
    1: [(3,1,2,1,d(4),m(3)),(4,1,1,2,d(2)),(5,1,1,3,d(2)),(6,2,1,4,h(2),p(3))],
    2: [(1,1,1,1,s(2),d(3)),(2,2,1,2,h(2),p(3))],
    3: [(2,1,2,1,d(3)),(3,2,1,2,h(2),p(3))],
    4: [(1,1,2,1,d(3,'g')),(2,2,2,1,h(3),p(4)),(3,2,2,1,h(3),p(4)),
        (4,1,2,1,d(3,'g')),(5,1,2,1,h(3),p(4)),(6,1,2,1,h(3),p(4)),
        (7,1,2,1,h(3),p(4)),(8,1,2,1,h(3),p(4)),(9,1,0,2,d(1)),
        (10,1,0,2,d(1)),(11,1,0,2,d(1))],
    5: [(1,1,2,1,s(3),d(4)),(2,1,0,2,d(1))],
    6: [(5,1,2,1,s(5,'g'),d(6,'g')),(6,1,1,2,d(2,'g')),(7,2,1,2,h(2),p(3)),(8,1,0,3,d(1))],
    7: [(2,1,1,1,s(2),d(3)),(3,2,1,1,h(2),p(3))],
    8: [(2,1,3,1,c(4))],
    9: [(1,1,2,1,d(4)),(2,2,1,1,h(2),p(3))],
    10: [(1,1,1,1,c(2))],
    11: [(2,1,2,1,c(3),s(6))],
    12: [(2,1,2,1,c(3))],
    13: [(2,2,2,1,c(3),('cat100',4,'g/100g'),('catM',5,'g/㎡'),
          ('patch100',6,'g/100g'),('patchM',7,'g/㎡'))],
    14: [(2,1,2,1,c(3))]
}

def numeric(raw, unit):
    if not raw:
        return None
    raw = unicodedata.normalize('NFKC',raw).replace('μ','µ').replace('㎍','µg')
    raw = raw.replace(',','').strip()
    if raw in ('-', '—', '×', '－'):
        return {'raw':raw,'excluded':True,'unit':unit}
    if re.fullmatch(r'1\s*×\s*106개(?:\(주\))?',raw):
        return {'raw':raw,'max':1_000_000,'unit':'개'}
    special = re.fullmatch(r'(?:비타민\s*A로서\s*)?(\d+)(만)?\s*(?:IU|단위)(?:\s*/\s*(100g|100\s*mL))?',raw)
    if special:
        basis = special[3].replace(' ','') if special[3] else ''
        return {'raw':raw,'max':int(special[1])*(10000 if special[2] else 1),
                'unit':'IU'+('/'+basis if basis else '')}
    iu = re.fullmatch(r'비타민 A로서 (\d+)만 I\.U\./100g \(비타민 A로서 (\d+)만 I\.U\./100g\)',raw)
    if iu:
        return {'raw':raw,'max':int(iu[1])*10_000,'alt':int(iu[2])*10_000,'unit':'IU/100g'}
    actual = re.search(r'(?<![a-z])(?:µg|mg|mL|IU|g)(?![a-z])',raw)
    if actual and unit not in ('g/100g','g/㎡'):
        unit = actual[0]
    n = r'\d+(?:\.\d+)?'
    match = re.fullmatch(fr'({n})\s*[~∼〜–-]\s*({n})\s*%?',raw)
    if match:
        return {'raw':raw,'min':float(match[1]),'max':float(match[2]),'unit':unit}
    reading = re.sub(r'\(?(?:에피네프린|글리시리진산)(?:으)?로서\)?|\(원생약환산량\)|주\s*\d+','',raw).strip()
    match = re.fullmatch(fr'({n})(?:\s*\(\s*({n})\s*\))?(?:\s*\[\*+({n})\])?(?:\s*\(?\s*(?:µg|mg|mL|IU|g|%|역가)\s*\)?)?(?:\*+)?',reading)
    if match:
        out={'raw':raw,'max':float(match[1]),'unit':unit}
        if match[2]:
            out['alt']=float(match[2])
        if match[3]:
            out['liquid']=float(match[3])
        return out
    return {'raw':raw,'unit':unit,'manual':True}

def cells(table):
    grid = [[None]*table['cols'] for row in table['rows']]
    for i,row in enumerate(table['rows']):
        for col,cs,rs,values in row:
            cell=[v for v in values if isinstance(v,str)]
            for rr in range(i,min(i+rs,len(grid))):
                for cc in range(col,col+cs):
                    grid[rr][cc] = cell
    return grid

def category(values):
    original = ' '.join(values or [])
    normalized = unicodedata.normalize('NFKC',original)
    match = re.search(r'(?<![A-Za-z])([IVX]+(?:\s*-\s*\d+)?)(?![A-Za-z])',normalized)
    if match:
        return match[1].replace(' ','')
    return next((g for g in '가나다라' if re.match(fr'^{g}\s*(란|$)',original)),'')

def heading_label(values, code):
    text = unicodedata.normalize('NFKC', ''.join(values or [])).lstrip('※').strip()
    if code:
        prefix = r'\s*'.join(map(re.escape, code))
        text = re.sub(fr'^{prefix}\s*(?:항목|란|항)?\s*', '', text, count=1)
    return text.strip(' ()')

def auxiliary_categories(chapter, tables):
    if chapter == 8:
        header = tables[3]['rows'][0]
        return {(category(vals), ''): heading_label(vals, category(vals))
                for _, _, _, vals in header if category(vals)}
    if chapter in (9, 10):
        group_names = {}
        for row in cells(tables[2 if chapter == 9 else 1])[3:]:
            group = category(row[0])
            item = re.match(r'(\d+)항', ''.join(row[1] or [])) if chapter == 9 else None
            if group:
                group_names[group, item[1] if item else ''] = ''.join(row[2 if chapter == 9 else 1] or [])
        return group_names
    return {}

def row_values(values, names):
    vals = list(values or [])
    if len(names) == 1:
        return [' '.join(vals)]
    if len(vals) == len(names):
        return vals
    if len(vals) == 1:
        return vals*len(names)
    return [' / '.join(vals)]*len(names)

def build(chapters):
    for chapter_no,chapter in enumerate(chapters,1):
        tables = [b for b in chapter['blocks'] if isinstance(b,dict)]
        named_categories = auxiliary_categories(chapter_no, tables)
        if chapter_no == 4:
            chapter['effectScopes'] = {
                category(group): {'name': heading_label(group, category(group)),
                                  'text': ', '.join(line.rstrip(', ') for line in effect)}
                for group,effect in cells(tables[12])[1:]
            }
        records = []
        for table_no,header,name_col,source,*limits in CONFIG[chapter_no]:
            table = tables[table_no-1]
            grid = cells(table)
            for row_idx,row in enumerate(grid[header:],header):
                names=row[name_col] or []
                names=[n for n in names if not n.startswith('삭제')]
                if not names or re.search(r'^유\s*효\s*성\s*분\s*명$', names[0]):
                    continue
                if name_col > 0 and row_idx > header and row[name_col] is grid[row_idx-1][name_col]:
                    if (chapter_no,table_no,row_idx) not in ((4,5,4),(9,1,8)):
                        continue
                group_cell = row[1 if chapter_no == 6 and table_no == 5 else 0] if name_col else None
                group=category(group_cell)
                if chapter_no == 7 and not group:
                    group_match = re.search(r'\d+(?=\s*항)', ' '.join(row[0] or []))
                    group = group_match[0] if group_match else ''
                item_cell = row[2 if chapter_no == 8 and group == 'IX' else 1] if name_col >= 2 else None
                subsection=' '.join(item_cell or [])
                item=re.search(r'(\d+(?:-\d+)?)\s*(?:항|란)',subsection)
                item=item[1] if item else ''
                item_code=item
                if (chapter_no,table_no) in ((4,2),(4,3)) and subsection.startswith('Ⅰ'):
                    item = '1'
                    item_code = 'I'
                group_name = heading_label(group_cell, group) or named_categories.get((group, ''), '')
                item_name = heading_label(item_cell, item_code) if item else ''
                item_name = item_name or named_categories.get((group, item), '')
                if chapter_no == 4 and table_no in (9, 10, 11):
                    group_name = {9: '건위제·소화제', 10: '정장제', 11: '지사제'}[table_no] + ' 배합용 비타민류'
                if chapter_no == 8 and group == 'XI':
                    group_name = '완화제 성분'
                if (chapter_no,table_no,row_idx) == (4,5,2):
                    continue
                # Some source paragraphs are line continuations within one cell.
                joins = {(2,1,5): [(4,5),(6,7),(8,9),(10,11),(12,13)],
                         (4,1,1): [(11,12)], (4,8,3):[(0,1)], (13,2,16):[(0,1)]}
                for start,end in reversed(joins.get((chapter_no,table_no,row_idx),[])):
                    names[start:end+1] = [''.join(names[start:end+1])]
                all_values = []
                shared = set()
                for key,col,unit in limits:
                    vals = row[col] or []
                    if chapter_no == 4 and table_no in (2,3,6,7,8) and key in ('herb','powder'):
                        if col == 4 and row[3] is row[4]:
                            continue
                        if col == 3 and row[3] is row[4]:
                            key = 'day'
                            if table_no == 7:
                                unit = 'mg'
                    if chapter_no == 4 and table_no == 5:
                        key = 'minimum' if row_idx == 1 else key
                        unit = '개' if row_idx == 1 else 'g'
                    if chapter_no == 4 and table_no == 4 and row_idx <= 4:
                        key = 'activity'
                        unit = '단위'
                    if chapter_no == 4 and table_no == 1 and row_idx == 1 and len(vals) == 27:
                        vals = vals[:7]+[' '.join(vals[7:9])]+vals[9:]
                    if (chapter_no,table_no,row_idx,col) == (9,1,4,4):
                        vals = [f'{vals[0]} {vals[1]}', *vals[2:]]
                    if chapter_no == 9 and table_no == 1 and row_idx in (7,8):
                        key = 'herb' if row_idx == 7 else 'powder'
                    if len(names) > 1 and len(vals) == 1:
                        shared.add(key)
                    all_values.append((key,unit,row_values(vals,names)))
                for j,name in enumerate(names):
                    values = {key:numeric(vals[j],unit) for key,unit,vals in all_values if vals[j]}
                    if not values:
                        values = {'day':{'raw':'별표 표 참고','unit':'','manual':True}}
                    record={'id':f'{table_no}-{row_idx+1}-{j+1}', 'name':name.removeprefix('△').strip(),
                            'mark':name.startswith('△'), 'group':group,'item':item,
                            'table':source,'tableIndex':table_no,'row':row_idx+1,'values':values}
                    if group_name:
                        record['groupName'] = group_name
                    if item_name:
                        record['itemName'] = item_name
                    if shared:
                        record['shared']=sorted(shared)
                    records.append(record)
        chapter['ingredients']=records
    return chapters

if __name__ == '__main__':
    content = build(extract(sys.argv[1]))
    out=json.dumps(content,ensure_ascii=False,separators=(',',':'))+'\n'
    Path(sys.argv[2]).write_text(out, encoding='utf-8', newline='\n')
