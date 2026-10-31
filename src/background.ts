import { z } from 'zod';
import { defaults, validate, createRecord, type Settings, type SavedRecord, type PageData, type Kind, type Provider } from './domain';
import { captureActivePage } from './pageCapture';
import { requestAI } from './ai';
const ready = Promise.all([chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }), chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })]);
const jobs = new Map<string, AbortController>();
let queue: Promise<unknown> = Promise.resolve();
async function settings(): Promise<Settings> { return { ...defaults, ...(await chrome.storage.local.get('settings')).settings };  }
const providerSchema = z.enum(['openai', 'deepseek']);
const keyName = (provider: Provider) => provider === 'openai' ? 'key' : 'key:deepseek';
async function key(provider?: Provider) { const name = keyName(provider || (await settings()).provider); return (await chrome.storage.session.get(name))[name] || (await chrome.storage.local.get(name))[name]; }
function mutate(fn: () => Promise<unknown>) { const next = queue.then(fn, fn); queue = next.catch(() => { }); return next; }
async function records(): Promise<SavedRecord[]> { return (await chrome.storage.local.get('records')).records || []; }
chrome.runtime.onInstalled.addListener(() => { void ready.then(async () => { await chrome.contextMenus.removeAll(); chrome.contextMenus.create({ id: 'clip', title: 'Save to CLIP//AI', contexts: ['selection'] }); chrome.contextMenus.create({ id: 'feedback', parentId: 'clip', title: 'Analyze as Feedback', contexts: ['selection'] }); await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); }); });
chrome.contextMenus.onClicked.addListener((info, tab) => { if (info.menuItemId !== 'feedback' || !tab?.id)
    return; const opening = chrome.sidePanel.open({ tabId: tab.id }); void chrome.storage.session.set({ pending: { text: (info.selectionText || '').slice(0, 4000), url: info.pageUrl || '', title: tab.title || '', platform: new URL(info.pageUrl || 'https://unknown.invalid').hostname, capturedAt: new Date().toISOString(), tags: [], likes: null, favorites: null, comments: null } }); void opening.catch(() => chrome.action.setBadgeText({ text: '!' })); });
const pageSchema = z.object({ title: z.string().max(1000), url: z.string().max(4000), platform: z.string().max(500), text: z.string().min(5).max(18000), capturedAt: z.string(), tags: z.array(z.string()).max(20), likes: z.null(), favorites: z.null(), comments: z.null() });
async function handle(m: Record<string, unknown>) {
    await ready;
    switch (m.type) {
        case 'init': return { settings: await settings(), hasKey: !!await key(), hasKeys: {openai: !!await key('openai'), deepseek: !!await key('deepseek')}, records: await records(), pending: (await chrome.storage.session.get('pending')).pending };
        case 'consume':
            await chrome.storage.session.remove('pending');
            await chrome.action.setBadgeText({ text: '' });
            return true;
        case 'settings': {
            const s = z.object({ provider: providerSchema.default('openai'), model: z.string().trim().min(1).max(150), remember: z.boolean(), preferences: z.object({ product: z.string().max(500), description: z.string().max(4000), audience: z.string().max(1000), goals: z.string().max(1000), reducedMotion: z.boolean() }) }).parse(m.settings);
            const supplied = z.string().max(1000).parse(m.key || '').trim();
            const k = supplied || await key(s.provider);
            const name = keyName(s.provider);
            await chrome.storage.local.set({ settings: s });
            await chrome.storage.local.remove(name);
            if (k)
                await (s.remember ? chrome.storage.local : chrome.storage.session).set({ [name]: k });
            if (s.remember)
                await chrome.storage.session.remove(name);
            return true;
        }
        case 'removeKey': {
            const name = keyName(providerSchema.parse(m.provider || (await settings()).provider));
            await chrome.storage.local.remove(name);
            await chrome.storage.session.remove(name);
            return true;
        }
        case 'capture': return captureActivePage();
        case 'page': {
            const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            return { title: t?.title || '手动输入', url: t?.url || '', platform: t?.url?.startsWith('http') ? new URL(t.url).hostname : 'Manual', text: '', capturedAt: new Date().toISOString(), tags: [], likes: null, favorites: null, comments: null };
        }
        case 'cancel':
            jobs.get(String(m.id))?.abort();
            return true;
        case 'models': {
            const provider = providerSchema.parse(m.provider || (await settings()).provider);
            const k = typeof m.key === 'string' && m.key.trim() ? m.key.trim() : await key(provider);
            if (!k)
                throw new Error('请先保存 API Key。');
            const response = await fetch(provider === 'deepseek' ? 'https://api.deepseek.com/models' : 'https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(20000) });
            if (!response.ok)
                throw new Error('无法读取模型列表，请手动输入模型名。');
            return ((await response.json()).data as {
                id: string;
            }[]).map(x => x.id).sort();
        }
        case 'test':
        case 'analyze': {
            const s = await settings();
            const provider = m.type === 'test' ? providerSchema.parse(m.provider || s.provider) : s.provider;
            const k = m.type === 'test' && typeof m.key === 'string' && m.key.trim() ? m.key.trim() : await key(provider);
            if (!k)
                throw new Error('请先在设置中配置 API Key。');
            const model = m.type === 'test' ? z.string().min(1).max(150).parse(m.model) : s.model;
            const id = z.string().parse(m.id);
            const controller = new AbortController();
            jobs.set(id, controller);
            const timer = setTimeout(() => controller.abort(), 120000);
            try {
                return await requestAI(k, model, controller.signal, m.type === 'analyze' ? z.enum(['content', 'feedback']).parse(m.kind) : undefined, m.type === 'analyze' ? pageSchema.parse(m.page) : undefined, { ...s, provider });
            }
            finally {
                clearTimeout(timer);
                jobs.delete(id);
            }
        }
        case 'save': return mutate(async () => { const kind = z.enum(['content', 'feedback']).parse(m.kind); const page = pageSchema.parse(m.page); const r = createRecord(kind, validate(kind, m.data), page, z.array(z.number().int().min(0).max(2)).parse(m.selectedIdeas)); const all = await records(); if (all.length >= 200)
            throw new Error('已达 200 条记录上限，请导出并删除部分记录。'); await chrome.storage.local.set({ records: [r, ...all] }); return r; });
        case 'delete': return mutate(async () => { await chrome.storage.local.set({ records: (await records()).filter(r => r.id !== m.id) }); return true; });
        case 'clear': return mutate(async () => { await chrome.storage.local.remove('records'); return true; });
        default: throw new Error('未知操作。');
    }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => { if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')))
    return false; handle(message).then(data => reply({ ok: true, data })).catch(e => reply({ ok: false, error: e instanceof z.ZodError ? '字段格式不正确，请检查输入。' : e instanceof Error ? e.message : '操作失败，请重试。' })); return true; });
