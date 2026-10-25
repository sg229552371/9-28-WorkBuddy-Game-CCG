from pathlib import Path
import re,json,hashlib,datetime,subprocess
R=Path(__file__).resolve().parents[3];B=R/'G_docs/X-GAMe';E=B/'evidence'
for name in ['AGENTS.md','HANDOFF.md','README.md','G_docs/dev_standard_and_playbook.md','G_docs/game_design_proposal.md','G_docs/skill_system_master_v1.md']:
 p=R/name;s=p.read_text(encoding='utf-8-sig');s=re.sub(r'^> \*\*X-GAMe v1现行入口\*\*.*\n\n*','',s,flags=re.M)
 if name in ['G_docs/game_design_proposal.md','G_docs/skill_system_master_v1.md']:
  lines=s.splitlines();lines.insert(1,'\n> 开发参考：[X-GAMe阅读地图](X-GAMe/00-reading-map.md)。本书记录实现事实与差异，不改变本文件已批准规则、适用范围与权威层级。\n');s='\n'.join(lines)+'\n'
 s=re.sub(r'\n{4,}','\n\n\n',s);p.write_text(s,encoding='utf-8')
p=B/'00-reading-map.md';s=p.read_text(encoding='utf-8').replace('编辑源是01～08分章','编辑源是00阅读地图、01～08分章');p.write_text(s,encoding='utf-8')
prov=json.loads((E/'sh-12-provenance.json').read_text(encoding='utf-8'));results=[]
for item,original in zip(prov['files'],['stdout.log','stderr.log']):
 source=Path(prov['source'])/original;copy=E/item['name'];a=hashlib.sha256(source.read_bytes()).hexdigest();b=hashlib.sha256(copy.read_bytes()).hexdigest();results.append({'original':str(source),'copy':item['name'],'sourceHash':a,'copyHash':b,'matches':a==b==item['sha256']})
(E/'red-evidence-verification.json').write_text(json.dumps({'checkedAt':datetime.datetime.now().astimezone().isoformat(),'results':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert all(x['matches'] for x in results)
# 在隔离VM中替换配置读取结果，验证缺键保护；不修改配置或现有快照。
js="""const fs=require('fs'),vm=require('vm');const source=fs.readFileSync('G_docs/X-GAMe/tools/snapshot-config.cjs','utf8');let writes=0;const mockFs={readFileSync:()=> 'const CFG={};',writeFileSync:()=>{writes++}};try{vm.runInNewContext(source,{require:n=>n==='fs'?mockFs:require(n),__dirname:require('path').resolve('G_docs/X-GAMe/tools'),console});process.exitCode=1;}catch(e){const ok=e.message==='Missing CFG key: heroes'&&writes===0;console.log(JSON.stringify({missingKeyRejected:ok,writes,message:e.message}));process.exitCode=ok?0:1;}"""
r=subprocess.run(['C:/Program Files/nodejs/node.exe','-e',js],cwd=R,text=True,capture_output=True);(E/'snapshot-negative-check.json').write_text(json.dumps({'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr},ensure_ascii=False,indent=2),encoding='utf-8');assert r.returncode==0
print('入口重复移除；批准边界保留；红测原件一致；快照缺键保护通过')
