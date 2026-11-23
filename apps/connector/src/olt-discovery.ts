import {execFile,spawn} from "node:child_process";
import {open,unlink} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {join} from "node:path";
import {promisify} from "node:util";
const install=promisify(execFile);
export type OltTask={id:string;lease:string;driver:string;config:{Address:string;Username:string;Password:string;HostKeySHA256:string}};

export class OltDiscovery {
  private busy=false;
  private completion:string|undefined;
  constructor(private readonly directory:string){}
  request(){
    return this.busy?{}:{oltSync:"1",...(this.completion?{oltCompletion:this.completion}:{})};
  }
  accept(sent:{oltSync?:string;oltCompletion?:string},task?:OltTask){
    if(sent.oltSync!=="1")return;
    if(this.completion===sent.oltCompletion)this.completion=undefined;
    if(!task || this.busy)return;
    this.busy=true;
    void this.run(task).finally(()=>{this.busy=false});
  }
  private async run(task:OltTask){
    let stage="INSTALL";
    try{
      if(!/^[a-z0-9]+(?:[.-][a-z0-9]+)*@[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(task.driver))throw Error();
      const [name,version]=task.driver.split("@") as [string,string];
      await install("/usr/local/bin/ispcontrol-driver",[name,version,"--version-only"],{timeout:140000});
      stage="IDENTIFY";
      const path=join("/dev/shm","ispcontrol-olt-"+randomUUID());
      const descriptor=await open(path,"wx+",0o600);
      let output:string;
      try {
        // An unlinked tmpfs descriptor can be reopened as /dev/stdin by native drivers.
        await unlink(path);
        const data=Buffer.from(JSON.stringify(task.config));
        await descriptor.write(data,0,data.length,0);
        output=await new Promise<string>((resolve,reject)=>{
          const child=spawn(join(this.directory,"drivers",name,version),["identify","--config","/dev/stdin"],{stdio:[descriptor.fd,"pipe","ignore"],timeout:90000});
          const chunks:Buffer[]=[];let size=0;
          child.stdout!.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>16384){child.kill();return}chunks.push(chunk)});
          child.once("error",reject);
          child.once("close",code=>code===0 && size<=16384?resolve(Buffer.concat(chunks).toString()):reject(Error("identification failed")));
        });
      }finally{await descriptor.close()}
      this.completion=JSON.stringify({id:task.id,lease:task.lease,facts:JSON.parse(output)});
    }catch{this.completion=JSON.stringify({id:task.id,lease:task.lease,error:stage})}
  }
}
