from pathlib import Path
import re,json,hashlib
B=Path(__file__).resolve().parents[1];R=B.parents[1]
for name in ['AGENTS.md','HANDOFF.md','G_docs/dev_standard_and_playbook.md']:
 p=R/name;s=p.read_text(encoding='utf-8-sig');pat=r'> \*\*2026-10-12 文档编书入口\*\*.*?(?=\n\n)';seen=[]
 def dedup(m):
  if m.group() in seen:return ''
  seen.append(m.group());return m.group()
 s=re.sub(pat,dedup,s,flags=re.S);p.write_text(s,encoding='utf-8')
p=B/'03-inventory-economy.md';s=p.read_text(encoding='utf-8');paras=s.split('\n\n');seen=set();out=[]
for x in paras:
 if x in seen and '当前数值快照' in x:continue
 seen.add(x);out.append(x)
p.write_text('\n\n'.join(out),encoding='utf-8')
p=B/'08-appendix-dictionary.md';s=p.read_text(encoding='utf-8');a=s.index('白名单覆盖：');b=s.index('\n\n生成后校验',a)
s=s[:a]+'白名单实际覆盖六个顶级键：heroes、levels、outLevel、skillSystem、camera、chips；完整键名目录另存keysAvailable。其他武器、怪物、模式、保险、触控和音频数值须按源码定位回查，当前快照不声称完整导出。快照包含配置源码SHA256，用于复现来源，不批准数值。'+s[b:]
s=s.replace('`tools/build_book.py`为每份源加稳定前缀锚点，重写合订中的源文件片内链接；相对路径保持在同目录解析。','`tools/build_book.py`按清单拼接原文，以分隔线分章；合订中的章节链接仍指向同目录编辑源，不重写标题锚点。')
s=s.replace('命令内测试文件、','')
p.write_text(s,encoding='utf-8')
p=B/'README.md';s=p.read_text(encoding='utf-8').replace('状态：书稿已落盘，最终质量检查进行中；','状态：v1文档交付版；');s=s.replace('# X-GAMe 开发参考书','# X-GAMe v1 项目书');s+='\n本书是项目总入口与规则主权威；已批准详细合同以受控附录身份纳入本书，发生冲突按受控索引的适用条款裁决，不能把整份旧文档认定全部有效。书冻结仅指本次文档基线，未来各批接口仍需串行冻结。\n';p.write_text(s,encoding='utf-8')
print('去重与工具能力声明已修正')
