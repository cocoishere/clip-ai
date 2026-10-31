import {extractPage} from './extract';

export async function activePageTab() {
    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    if (tab?.id === undefined) throw new Error('未找到当前标签页，请先打开笔记网页，再点击工具栏上的 CLIP//AI 图标。');
    // Missing URL means Chrome may be withholding metadata, not that this is a restricted page.
    if (tab.url && !/^https?:\/\//i.test(tab.url)) {
        throw new Error('此页面属于浏览器内部页或其他受限页面，请切换普通 HTTP/HTTPS 网页，或手动粘贴。');
    }
    return tab;
}

export async function captureActivePage() {
    const tab = await activePageTab();
    let results: chrome.scripting.InjectionResult<ReturnType<typeof extractPage>>[];
    try {
        results = await chrome.scripting.executeScript({target: {tabId: tab.id!}, func: extractPage});
    } catch {
        throw new Error('尚未获得当前页面读取权限，或页面已经关闭。请回到该网页，重新点击 Chrome 工具栏上的 CLIP//AI 图标后重试；小红书也可点击「授权读取小红书」。仍失败可手动粘贴。');
    }
    const page = results[0]?.result;
    if (!page) throw new Error('页面未返回内容，请等待笔记加载完成后重试，或手动粘贴。');
    if (!/^https?:\/\//i.test(page.url)) throw new Error('当前页面类型不支持读取，请手动粘贴。');
    return page;
}
