#!/usr/bin/env node
import {createHash, randomUUID, verify} from "node:crypto";
import {mkdir, readFile, rename, rm, symlink, writeFile} from "node:fs/promises";
import {join} from "node:path";

async function download(url, limit) {
  const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw Error("Repositorio HTTP "+response.status);
  const chunks=[];
  let bytes=0;
  for await (const chunk of response.body) {
    bytes+=chunk.length;
    if(bytes>limit) throw Error("Paquete demasiado grande");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function install(name,version,mode) {
  if (![name,version].every(x=>typeof x==="string" && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(x))) throw Error("Uso: ispcontrol-driver NOMBRE VERSION");
  const arch={x64:"amd64",arm64:"arm64"}[process.arch];
  if (process.platform!=="linux" || !arch) throw Error("Arquitectura no soportada");
  const url=new URL("/api/v1/apt/drivers/"+name+"/"+version+"/",process.env.ISPCONTROL_API_URL);
  const {manifest,signature}=JSON.parse(await download(new URL("manifest.json",url),65536));
  const key=await readFile(new URL("repository.pub",import.meta.url));
  if(!verify(null,Buffer.from(JSON.stringify(manifest)),key,Buffer.from(signature,"base64")) ||
     manifest.schema!==1 || manifest.name!==name || manifest.version!==version) throw Error("Manifiesto inválido");
  const target=manifest.targets["linux/"+arch];
  if (!target || !Number.isSafeInteger(target.size) || target.size<=0 || target.size>64*1024*1024 || !/^[a-f0-9]{64}$/.test(target.sha256)) throw Error("Paquete no disponible para linux/"+arch);
  const directory=join(process.env.ISPCONTROL_DATA_DIR||"/var/lib/ispcontrol","drivers",name);
  await mkdir(directory,{recursive:true});
  const executable=join(directory,version);
  const temp=join(directory,".stage-"+randomUUID());
  const link=temp+"-link";
  const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
  try {
    let cached;
    try {cached=await readFile(executable)} catch(error){if(error.code!=="ENOENT")throw error}
    if(!cached || digest(cached)!==target.sha256){
      const bytes=await download(new URL("linux/"+arch+"/driver",url),target.size);
      if(bytes.length!==target.size || digest(bytes)!==target.sha256) throw Error("Integridad de paquete inválida");
      await writeFile(temp,bytes,{flag:"wx",mode:0o755});
      await rename(temp,executable);
    }
    if(mode==="--version-only")return;
    await symlink(version,link);
    await rename(link,join(directory,"current"));
    console.log(name+" "+version+" linux/"+arch+" instalado");
  } finally {await Promise.all([rm(temp,{force:true}),rm(link,{force:true})])}
}
install(...process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1});
