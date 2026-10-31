import {it,expect,vi} from 'vitest';
it('isolates provider keys, migrates legacy OpenAI settings, and removes only the selected key',async()=>{
 const local:Record<string,unknown>={key:'legacy-openai'};const session:Record<string,unknown>={};
 const area=(data:Record<string,unknown>)=>({setAccessLevel:async()=>{},get:async(k:string)=>({[k]:data[k]}),set:async(v:Record<string,unknown>)=>Object.assign(data,v),remove:async(k:string)=>{delete data[k];}});
 let listener:(m:unknown,s:unknown,r:(v:any)=>void)=>void=()=>{};
 vi.stubGlobal('chrome',{storage:{local:area(local),session:area(session)},runtime:{id:'test',getURL:()=> 'chrome-extension://test/',onInstalled:{addListener:vi.fn()},onMessage:{addListener:(fn:typeof listener)=>listener=fn}},contextMenus:{onClicked:{addListener:vi.fn()}},action:{}});
 const transport=vi.fn().mockImplementation(async(url:string)=>new Response(JSON.stringify(url.includes('deepseek')?{choices:[{message:{content:'OK'}}]}:{output:[{content:[{type:'output_text',text:'OK'}]}]})));
 vi.stubGlobal('fetch',transport);
 try{
  await import('../src/background');
  const send=(m:unknown)=>new Promise<any>(resolve=>listener(m,{id:'test',url:'chrome-extension://test/sidepanel.html'},resolve));
  const first=await send({type:'init'});expect(first.data.settings.provider).toBe('openai');
  const preferences=first.data.settings.preferences;
  expect((await send({type:'settings',settings:{provider:'deepseek',model:'deepseek-flash',remember:false,preferences},key:'deepseek-test'})).ok).toBe(true);
  expect(local.key).toBe('legacy-openai');expect(session['key:deepseek']).toBe('deepseek-test');
  await send({type:'test',provider:'openai',model:'test',id:'one'});await send({type:'test',provider:'deepseek',model:'test',id:'two'});
  expect(transport.mock.calls[0][0]).toContain('api.openai.com');expect(transport.mock.calls[0][1].headers.Authorization).toBe('Bearer legacy-openai');
  expect(transport.mock.calls[1][0]).toContain('api.deepseek.com');expect(transport.mock.calls[1][1].headers.Authorization).toBe('Bearer deepseek-test');
  await send({type:'removeKey',provider:'deepseek'});expect(session['key:deepseek']).toBeUndefined();expect(local.key).toBe('legacy-openai');
 }finally{vi.unstubAllGlobals();}
});
