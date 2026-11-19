import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Include newly added modules automatically. A syntax error in an imported screen
// must fail the same check as an error in the application shell.
function checkDirectory(directory){
 for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  if(['node_modules','data'].includes(item.name))continue;
  const target=path.join(directory,item.name);
  if(item.isDirectory())checkDirectory(target);
  else if(item.name.endsWith('.js')){
   const result=spawnSync(process.execPath,['--check',target],{stdio:'inherit'});
   if(result.status!==0)process.exit(result.status||1);
  }
 }
}
checkDirectory('.');
console.log('All JavaScript source files passed syntax checks.');
