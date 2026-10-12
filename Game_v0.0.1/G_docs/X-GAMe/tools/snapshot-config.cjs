const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..');
const source=fs.readFileSync(path.join(root,'js/config.js'),'utf8');
const ctx=vm.createContext({});
vm.runInContext(source+'\nthis.__cfg=CFG;',ctx,{timeout:5000});
const keys=['heroes','levels','outLevel','skillSystem','camera','chips'];
const values={};for(const k of keys){if(!(k in ctx.__cfg))throw new Error('Missing CFG key: '+k);values[k]=ctx.__cfg[k];}
const result={source:'js/config.js',sha256:crypto.createHash('sha256').update(source).digest('hex'),keysAvailable:Object.keys(ctx.__cfg),values};
fs.writeFileSync(path.join(root,'G_docs/X-GAMe/evidence/config-snapshot.json'),JSON.stringify(result,null,2)+'\n');
console.log('CFG snapshot saved; keys='+keys.join(','));
