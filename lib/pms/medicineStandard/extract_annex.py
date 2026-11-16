"""Read paragraphs and merged tables from the supplied Annex 1 HWPX."""
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

HP = '{http://www.hancom.co.kr/hwpml/2011/paragraph}'

def paragraph_text(p):
    runs = (''.join(t.itertext()) for run in p.findall(f'{HP}run')
            for t in run.findall(f'{HP}t'))
    return re.sub(r'\s+', ' ', ''.join(runs)).strip()

def content(parent):
    blocks = []
    for p in parent.findall(f'{HP}p'):
        text = paragraph_text(p)
        if text:
            blocks.append(text)
        for table in p.findall(f'{HP}run/{HP}tbl'):
            rows = []
            for row in table.findall(f'{HP}tr'):
                cells = []
                for cell in row.findall(f'{HP}tc'):
                    col = int(cell.find(f'{HP}cellAddr').get('colAddr'))
                    span = cell.find(f'{HP}cellSpan')
                    values = content(cell.find(f'{HP}subList'))
                    cells.append([col, int(span.get('colSpan')), int(span.get('rowSpan')), values])
                rows.append(cells)
            blocks.append({'cols': int(table.get('colCnt')), 'rows': rows})
    return blocks

def extract(path):
    chapters = []
    with ZipFile(path) as archive:
        sections = sorted((n for n in archive.namelist()
                           if re.fullmatch(r'Contents/section\d+.xml', n)),
                          key=lambda n: int(re.search(r'\d+', n)[0]))
        for section in sections:
            for block in content(ET.fromstring(archive.read(section))):
                if isinstance(block, str) and re.match(r'^제\s*\d+\s*장', block):
                    chapters.append({'title': block, 'blocks': []})
                elif chapters:
                    chapters[-1]['blocks'].append(block)
    assert len(chapters) == 14
    return chapters

if __name__ == '__main__':
    chapters = extract(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(chapters, ensure_ascii=False), encoding='utf-8')
    if len(sys.argv) > 3:
        with Path(sys.argv[3]).open('w', encoding='utf-8') as f:
            for chapter in chapters:
                print(chapter['title'], file=f)
                i = 0
                for block in chapter['blocks']:
                    if isinstance(block, str):
                        print(block, file=f)
                        continue
                    i += 1
                    print(f'~TABLE {i} {len(block["rows"])}x{block["cols"]}', file=f)
                    for row in block['rows']:
                        print(' | '.join(f'[{c},{cs},{rs}] '+ ' / '.join(v for v in vs if isinstance(v,str)) for c,cs,rs,vs in row),file=f)
                    print('~END TABLE', file=f)
