import {execFile} from "node:child_process";
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
      const output=await new Promise<string>((resolve,reject)=>{
        const proc=execFile(join(this.directory,"drivers",name,version),["identify","--config","/dev/stdin"],{timeout:90000,maxBuffer:16384},(err,out)=>err?reject(err):resolve(out));
        proc.stdin?.on("error",reject);
        proc.stdin?.end(JSON.stringify(task.config));
      });
      this.completion=JSON.stringify({id:task.id,lease:task.lease,facts:JSON.parse(output)});
    }catch{this.completion=JSON.stringify({id:task.id,lease:task.lease,error:stage})}
  }
}
