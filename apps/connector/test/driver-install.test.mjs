import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign,createHash} from "node:crypto";
import {createServer} from "node:http";
import {mkdtemp,copyFile,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
test("only a signed matching artifact can replace the active driver",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"isp-driver-test-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await copyFile(new URL("../drivers/install.mjs",import.meta.url),join(dir,"install.mjs"));
  const {publicKey,privateKey}=generateKeyPairSync("ed25519");
  await writeFile(join(dir,"repository.pub"),publicKey.export({format:"pem",type:"spki"}));
  let corrupt=false,wrongSignature=false;
  const bytes=Buffer.from("driver");
  const server=createServer((req,res)=>{
    if(!req.url.endsWith("manifest.json"))return res.end(corrupt?"broken":bytes);
    const version=req.url.split("/").at(-2);
    const manifest={schema:1,name:"test",version,targets:{"linux/amd64":{size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}}};
    const signature=sign(null,Buffer.from(JSON.stringify(manifest)),privateKey).toString("base64");
    res.end(JSON.stringify({manifest,signature:wrongSignature?"invalid":signature}));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const install=v=>promisify(execFile)(process.execPath,[join(dir,"install.mjs"),"test",v],{env:{...process.env,ISPCONTROL_DATA_DIR:dir,ISPCONTROL_API_URL:"http://127.0.0.1:"+server.address().port}});
  if(process.arch!=="x64" || process.platform!=="linux"){t.skip("linux/amd64 fixture");return}
  await install("1.0.0");
  corrupt=true;await assert.rejects(install("2.0.0"),/Integridad/);
  wrongSignature=true;await assert.rejects(install("2.0.0"),/Manifiesto/);
  assert.deepEqual(await readFile(join(dir,"drivers/test/current")),bytes);
});
