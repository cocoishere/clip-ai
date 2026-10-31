import {describe,it,expect,vi,afterEach} from 'vitest';
import {csvCell,toCsv,exportTables} from '../src/csv';
import {createRecord,feedbackSchema,contentSchema,defaults,safeUrl} from '../src/domain';
import {requestAI} from '../src/ai';
const feedback={originalFeedback:'批量修改很麻烦',feedbackSummary:'重复操作',feedbackType:'Usability Issue' as const,productModule:'Needs More Context',userScenario:'修改数据',userPainPoint:'重复操作',potentialRequirement:'推测：批量编辑',sentiment:'Negative' as const,suggestedImprovement:'调研流程',confidenceLevel:'Low' as const,prioritySuggestion:'Needs More Context' as const,priorityReason:'AI 初步判断，缺少频次',status:'Pending Review' as const,tags:['编辑']};
const page={title:'测试',url:'https://example.com',platform:'example.com',text:'批量修改很麻烦',capturedAt:'2026-10-30',tags:[],likes:null,favorites:null,comments:null};
afterEach(()=>vi.unstubAllGlobals());
describe('export & schema safety',()=>{
it('escapes Chinese, commas, quotes and newlines with BOM',()=>{expect(toCsv([{Title:'中文,"标题"\n第二行'}],['Title'])).toBe('\uFEFF"Title"\r\n"中文,""标题""\n第二行"');});
it('neutralizes spreadsheet formulas including leading whitespace',()=>{for(const v of ['=1+1',' +cmd','\t@SUM(1)','-1'])expect(csvCell(v).startsWith('"\'')).toBe(true);expect(csvCell(null)).toBe('""');});
it('validates enums and refuses incomplete records',()=>{expect(feedbackSchema.safeParse(feedback).success).toBe(true);expect(feedbackSchema.safeParse({...feedback,sentiment:'unknown'}).success).toBe(false);expect(contentSchema.safeParse({}).success).toBe(false);});
it('does not retain full webpage body and keeps original feedback',()=>{const r=createRecord('feedback',feedback,page);expect(r.page).not.toHaveProperty('text');expect(r.data).toHaveProperty('originalFeedback',page.text);expect(exportTables([r])[0].csv).toContain('Original Feedback');});
it('blocks executable source links',()=>{expect(safeUrl('javascript:alert(1)')).toBe('');expect(safeUrl('https://example.com')).toBe('https://example.com/');});
it('requires exactly three remix ideas and exports linked individual rows',()=>{const idea={topicTitle:'标题',targetAudience:'运营',userPainPoint:'整理费时',contentAngle:'流程',suggestedStructure:'三步',suggestedHook:'开头',recommendedProductScenario:'待核实',whyThisIdeaFits:'方法可迁移'};const keys=['noteTitle','contentCategory','targetAudience','coreMessage','hookAnalysis','contentStructure','writingStyle','audiencePainPoint','contentHighlights','engagementMechanism','whyItWorks','reusableContentPattern','potentialApplication','inspirationSummary'];const d={...Object.fromEntries(keys.map(k=>[k,'分析'])),topicTags:[],ideas:[idea,idea,idea]};const valid=contentSchema.parse(d);expect(contentSchema.safeParse({...d,ideas:[idea]}).success).toBe(false);const r=createRecord('content',valid,page,[0,2]);const tables=exportTables([r]);expect(tables[1].rows.length).toBe(2);expect(tables[1].rows[0]['Source Note ID']).toBe(r.id);});
});
describe('real provider error boundaries using mocked transport',()=>{
for(const [status,code,message] of [[401,'invalid_api_key','API Key 无效'],[429,'insufficient_quota','额度不足'],[429,'rate_limit_exceeded','限流'],[404,'model_not_found','模型不存在']] as const)it(`maps ${code}`,async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code}}),{status})));await expect(requestAI('test','model',new AbortController().signal)).rejects.toThrow(message);});
it('handles network loss',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError()));await expect(requestAI('test','model',new AbortController().signal)).rejects.toThrow('网络');});
it('handles timeout or cancellation',async()=>{const c=new AbortController();c.abort();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error()));await expect(requestAI('test','model',c.signal)).rejects.toThrow('取消或超时');});
it('rejects malformed structured output',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'{}'}]}]}))));await expect(requestAI('test','model',new AbortController().signal,'feedback',page,defaults)).rejects.toThrow('结构校验');});
it('forces original feedback from user input rather than trusting model',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({...feedback,originalFeedback:'invented'})}]}]}))));const result=await requestAI('test','model',new AbortController().signal,'feedback',page,defaults);expect(result).toHaveProperty('originalFeedback',page.text);});
});

describe('DeepSeek provider',()=>{
 const settings={...defaults,provider:'deepseek' as const};
 it('uses the official endpoint and JSON mode, validates structured feedback',async()=>{
  const transport=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(feedback)}}]})));
  vi.stubGlobal('fetch',transport);
  const result=await requestAI('deepseek-test','deepseek-flash',new AbortController().signal,'feedback',page,settings);
  const [url,init]=transport.mock.calls[0];expect(url).toBe('https://api.deepseek.com/chat/completions');
  const body=JSON.parse(init.body);expect(body.response_format).toEqual({type:'json_object'});expect(body.messages[0].content).toContain('JSON');expect(body).not.toHaveProperty('store');expect(result).toHaveProperty('originalFeedback',page.text);
 });
 it('tests the selected model without JSON output mode',async()=>{
  const transport=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'OK'}}]})));
  vi.stubGlobal('fetch',transport);expect(await requestAI('test','custom-model',new AbortController().signal,undefined,undefined,settings)).toBe(true);
  const body=JSON.parse(transport.mock.calls[0][1].body);expect(body.model).toBe('custom-model');expect(body).not.toHaveProperty('response_format');
 });
 for(const [payload,message] of [[{choices:[{message:{content:'   '}}]},'空内容'],[{choices:[{finish_reason:'length',message:{content:'{}'}}]},'未完成'],[{choices:[{message:{content:'{}'}}]},'结构校验']] as const)it(`rejects ${message}`,async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));await expect(requestAI('test','deepseek-flash',new AbortController().signal,'feedback',page,settings)).rejects.toThrow(message);
 });
 it('reports DeepSeek balance errors',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'balance'}}),{status:402})));
  await expect(requestAI('test','deepseek-flash',new AbortController().signal,undefined,undefined,settings)).rejects.toThrow('DeepSeek');
 });
});
