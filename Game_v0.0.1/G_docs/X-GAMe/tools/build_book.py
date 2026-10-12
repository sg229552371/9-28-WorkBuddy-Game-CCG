from pathlib import Path
import json,re,hashlib,sys
B=Path(__file__).resolve().parents[1]; R=B.parents[1]
def render():
 names=json.loads((B/'book-manifest.json').read_text(encoding='utf-8'))
 return '\n\n---\n\n'.join((B/n).read_text(encoding='utf-8').strip() for n in names if n!='X-GAMe-v1.md')+'\n'
if __name__=='__main__':
 text=render(); p=B/'X-GAMe-v1.md'
 if '--check' in sys.argv:
  ok=p.exists() and p.read_bytes()==text.encode('utf-8');print('合订一致='+str(ok));sys.exit(0 if ok else 1)
 p.write_bytes(text.encode('utf-8'));print('合订字符='+str(len(text)))
