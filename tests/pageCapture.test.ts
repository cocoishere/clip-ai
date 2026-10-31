import {afterEach,describe,expect,it,vi} from 'vitest';
import {captureActivePage} from '../src/pageCapture';
afterEach(()=>vi.unstubAllGlobals());
const result={url:'https://www.xiaohongshu.com/explore/example',text:'可见笔记正文'};
function mock(tab:unknown, fail=false){
 const query=vi.fn().mockResolvedValue(tab?[tab]:[]);
 const executeScript=fail?vi.fn().mockRejectedValue(new Error('Cannot access contents of url')):vi.fn().mockResolvedValue([{result}]);
 vi.stubGlobal('chrome',{tabs:{query},scripting:{executeScript}});
 return {query,executeScript};
}
describe('page permissions and capture',()=>{
 it('does not classify missing tab URL as a restricted page',async()=>{
  const {query,executeScript}=mock({id:10});expect(await captureActivePage()).toEqual(result);
  expect(query).toHaveBeenCalledWith({active:true,lastFocusedWindow:true});expect(executeScript.mock.calls[0][0].target).toEqual({tabId:10});
 });
 it('explains how to grant access when Chrome rejects injection',async()=>{
  mock({id:10},true);await expect(captureActivePage()).rejects.toThrow('读取权限');
 });
 it('blocks known internal pages before injection',async()=>{
  const {executeScript}=mock({id:10,url:'chrome://extensions/'});await expect(captureActivePage()).rejects.toThrow('受限页面');expect(executeScript).not.toHaveBeenCalled();
 });
 it('reports a missing active tab separately',async()=>{mock(undefined);await expect(captureActivePage()).rejects.toThrow('未找到当前标签页');});
 it('captures a permitted Xiaohongshu note',async()=>{mock({id:10,url:result.url});expect(await captureActivePage()).toEqual(result);});
});
