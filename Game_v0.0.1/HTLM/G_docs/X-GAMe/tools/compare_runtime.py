from pathlib import Path
import json,hashlib,datetime
B=Path(__file__).resolve().parents[1]; E=B/'evidence'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
results=[]
for name in ['runtime-before.json','runtime-continuation-before.json']:
 rows=load(E/name); changed=[];missing=[]
 for row in rows:
  p=Path(row['Path'])
  if not p.exists():missing.append(str(p))
  elif hashlib.sha256(p.read_bytes()).hexdigest().lower()!=row['Hash'].lower():changed.append(str(p))
 results.append({'baseline':name,'count':len(rows),'changed':changed,'missing':missing,'passed':not(changed or missing)})
out={'checkedAt':datetime.datetime.now().astimezone().isoformat(),'results':results,'note':'原基线仅34个JS；续轮基线含HTML/CSS，共36文件。十六进制摘要统一大小写比较。'}
(E/'runtime-hash-comparison.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,ensure_ascii=False));raise SystemExit(0 if all(r['passed'] for r in results) else 1)
