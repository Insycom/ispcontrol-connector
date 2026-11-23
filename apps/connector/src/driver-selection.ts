import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
const install=promisify(execFile);
const spec=/^[a-z0-9]+(?:[.-][a-z0-9]+)*@[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export class DriverSelection {
  status:string|undefined;
  private applied:string|undefined;
  private busy=false;
  constructor(private readonly directory:string){}
  async reconcile(selection:unknown){
    if(!Array.isArray(selection) || selection.length>16 || !selection.every(s=>typeof s==="string"&&spec.test(s)))return;
    const desired:string[]=selection;
    const revision=JSON.stringify(desired);
    if(this.busy || this.applied===revision)return;
    this.busy=true;
    const root=join(this.directory,"drivers");
    const file=join(root,"selection.json");
    try{
      await mkdir(root,{recursive:true});
      let previous:string[]=[];
      try{previous=JSON.parse(await readFile(file,"utf8"))}catch(err){if((err as NodeJS.ErrnoException).code!=="ENOENT")throw err}
      for(const entry of desired){
        this.status="Instalando "+entry;
        await install("/usr/local/bin/ispcontrol-driver",entry.split("@"),{timeout:140000});
      }
      const names=new Set(desired.map(entry=>entry.split("@")[0]));
      for(const entry of previous){
        if(spec.test(entry)&&!names.has(entry.split("@")[0]))await rm(join(root,entry.split("@")[0],"current"),{force:true});
      }
      await writeFile(file+".tmp",revision);
      await rename(file+".tmp",file);
      this.applied=revision;
      this.status=desired.length?"Instalado: "+desired.join(", "):"Sin drivers asignados";
    }catch(error){
      this.status=("Error de instalación: "+(error instanceof Error?error.message:"desconocido")).slice(0,510);
    }finally{this.busy=false}
  }
}
