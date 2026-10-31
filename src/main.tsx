import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, MotionConfig } from 'motion/react';
import { Sparkles, MessageSquare, ArrowUpRight, Settings as Gear, History, ArrowLeft, Check, Download, Copy, Trash2, Globe, ScanLine, LoaderCircle, KeyRound, X } from 'lucide-react';
import { defaults, validate, safeUrl, type Kind, type Provider, type Settings, type PageData, type Analysis, type SavedRecord } from './domain';
import { downloadRecords } from './csv';
import './style.css';
async function call<T>(type: string, args: Record<string, unknown> = {}): Promise<T> { if (!globalThis.chrome?.runtime?.id)
    throw new Error('请在 Chrome 加载 dist 插件后使用。'); const r = await chrome.runtime.sendMessage({ type, ...args }); if (!r?.ok)
    throw new Error(r?.error || 'Service Worker 连接中断，请重试；已编辑的内容会保留。'); return r.data; }
const emptyPage: PageData = { title: '手动输入', url: '', platform: 'Manual', text: '', capturedAt: new Date().toISOString(), tags: [], likes: null, favorites: null, comments: null };
function App() {
    const [view, setView] = useState('home'), [kind, setKind] = useState<Kind>('content'), [config, setConfig] = useState<Settings>(defaults), [key, setKey] = useState(''), [connected, setConnected] = useState(false), [models, setModels] = useState<string[]>([]), [page, setPage] = useState<PageData>(emptyPage), [data, setData] = useState<Analysis | null>(null), [records, setRecords] = useState<SavedRecord[]>([]), [selected, setSelected] = useState([0, 1, 2]), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [job, setJob] = useState(''), [saved, setSaved] = useState(false);
    const [hasKeys, setHasKeys] = useState<Record<Provider, boolean>>({openai:false,deepseek:false});
    const run = async (fn: () => Promise<void>) => { setError(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
    } };
    function acceptPending(p: PageData) { setPage(p); setKind('feedback'); setView('input'); setData(null); void call('consume'); }
    useEffect(() => { void run(async () => { const r = await call<{
        settings: Settings;
        hasKey: boolean;
        hasKeys: Record<Provider, boolean>;
        records: SavedRecord[];
        pending?: PageData;
    }>('init'); setConfig(r.settings); setHasKeys(r.hasKeys); setConnected(r.hasKey); setRecords(r.records); if (r.pending)
        acceptPending(r.pending);
    else {
        if (!r.hasKey)
            setView('settings');
        setPage(await call('page'));
    } }); if (!globalThis.chrome?.storage)
        return; const listener = (changes: {
        [key: string]: chrome.storage.StorageChange;
    }, area: string) => { if (area === 'session' && changes.pending?.newValue)
        acceptPending(changes.pending.newValue); }; chrome.storage.onChanged.addListener(listener); return () => chrome.storage.onChanged.removeListener(listener); }, []);
    useEffect(() => { if (!notice)
        return; const t = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(t); }, [notice]);
    const capture = async (k: Kind) => { setKind(k); setView('input'); setData(null); setSaved(false); setBusy('READING CONTENT…'); try {
        setPage(await call('capture'));
        setNotice('CONTENT CAPTURED ✓ · 请检查后分析');
    }
    finally {
        setBusy('');
    } };
    async function authorizeXiaohongshu() {
        // Invoke directly in the button handler, before any await, to preserve the user gesture.
        const granted = await chrome.permissions.request({origins: ['https://*.xiaohongshu.com/*']});
        if (!granted) throw new Error('未授予小红书读取权限。可以重新点击工具栏图标临时授权，或手动粘贴。');
        await capture(kind);
    }
    async function analyze() { if (page.text.trim().length < 5)
        throw new Error('请至少输入 5 个字符。'); if (kind === 'feedback' && page.text.length > 4000)
        throw new Error('单条反馈最多 4,000 字符，请缩短输入。'); const id = crypto.randomUUID(); setJob(id); setBusy(kind === 'content' ? 'ANALYZING CONTENT & GENERATING IDEAS…' : 'EXTRACTING KEY INSIGHTS…'); setSaved(false); try {
        const result = await call<Analysis>('analyze', { id, kind, page });
        setBusy('BUILDING STRUCTURED DATA…');
        validate(kind, result);
        setData(result);
        setSelected([0, 1, 2]);
        setView('preview');
    }
    finally {
        setBusy('');
        setJob('');
    } }
    async function copy(value: unknown) { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); setNotice('COPIED ✓'); }
    function openRecord(r: SavedRecord) { setKind(r.kind); setPage({ ...r.page, text: 'originalFeedback' in r.data ? r.data.originalFeedback : '此记录不保留网页正文' }); setData(r.data); setSelected(r.selectedIdeas); setSaved(true); setView('preview'); }
    const field = (label: string, value: string, onChange: (s: string) => void, multi = false) => <label className="field">{label}{multi ? <textarea value={value} onChange={e => onChange(e.target.value)}/> : <input value={value} onChange={e => onChange(e.target.value)}/>}</label>;
    function renderFields(obj: Record<string, unknown>, change: (v: Record<string, unknown>) => void) { return Object.entries(obj).filter(([k]) => k !== 'ideas').map(([k, v]) => { const enums: Record<string, string[]> = { feedbackType: ['Bug', 'Feature Request', 'Usability Issue', 'Performance', 'Documentation', 'Positive Feedback', 'Other'], sentiment: ['Positive', 'Neutral', 'Negative', 'Mixed'], confidenceLevel: ['High', 'Medium', 'Low', 'Needs More Context'], prioritySuggestion: ['High', 'Medium', 'Low', 'Needs More Context'], status: ['Pending Review'] }; return enums[k] ? <label className="field" key={k}>{k.replace(/([A-Z])/g, ' $1')}<select value={String(v)} onChange={e => change({ ...obj, [k]: e.target.value })}>{enums[k].map(x => <option key={x}>{x}</option>)}</select></label> : <React.Fragment key={k}>{field(k.replace(/([A-Z])/g, ' $1'), Array.isArray(v) ? v.join(' | ') : String(v), s => change({ ...obj, [k]: Array.isArray(v) ? s.split('|').map(x => x.trim()).filter(Boolean) : s }), true)}</React.Fragment>; }); }
    return <MotionConfig reducedMotion={config.preferences.reducedMotion ? 'always' : 'user'}><div className={config.preferences.reducedMotion ? 'app reduced' : 'app'}><header><button className="brand" onClick={() => setView('home')}><img src="/icons/logo.svg"/>CLIP<span>{"//"}</span>AI</button><div className="tools"><span className={'dot '+(connected?'online':'')} title={connected?'已配置 Key；测试连接可验证调用':'尚未配置 Key'}/><button title="历史记录" onClick={()=>setView('history')}><History size={18}/></button><button title="设置" onClick={()=>setView('settings')}><Gear size={18}/></button></div></header>
    {view !== 'home' && <button className="back" onClick={() => setView('home')}><ArrowLeft size={14}/> WORKSPACE</button>}
    {error && <div className="alert" role="alert">{error}<button title="关闭错误" onClick={() => setError('')}><X size={14}/></button></div>}{notice && <div className="toast" role="status"><Check size={16}/>{notice}</div>}
    {busy && <div className="processing" role="status"><LoaderCircle className="spin"/><b>{busy}</b><p>正在处理你的请求。文本仍保留在当前工作区。</p>{job && <button onClick={() => void run(async () => { await call('cancel', { id: job }); })}>取消请求</button>}</div>}
    {view === 'home' && <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><div className="eyebrow">YOUR INTELLIGENCE WORKSPACE</div><h1>Less noise.<br /><span>More insight.</span></h1><p className="intro">From Content to Insights.<br />把值得关注的内容，变成下一步行动。</p><div className="page"><Globe size={18}/><div><small>CURRENT PAGE</small><strong>{page.title}</strong><span>{page.platform}</span></div><span className="live">{page.url ? "PAGE" : "MANUAL"}</span></div><button className="radar purple" disabled={!!busy} onClick={() => void run(() => capture('content'))}><div className="cardtop"><span className="icon"><Sparkles /></span><small>01 / CREATE</small><ArrowUpRight /></div><h2>CONTENT RADAR</h2><p>Turn great content into<br />your next big idea.</p><div className="cardfoot">ANALYZE CONTENT <span>→</span></div></button><button className="radar cyan" disabled={!!busy} onClick={() => void run(() => capture('feedback'))}><div className="cardtop"><span className="icon"><MessageSquare /></span><small>02 / DISCOVER</small><ArrowUpRight /></div><h2>FEEDBACK RADAR</h2><p>Turn user voices into<br />actionable insights.</p><div className="cardfoot">EXTRACT INSIGHTS <span>→</span></div></button><div className="section-title">RECENT INSIGHTS <span>{records.length} SAVED</span></div>{records.slice(0, 3).map(r => <button className="record" key={r.id} onClick={() => openRecord(r)}>{r.kind === 'content' ? <Sparkles size={16}/> : <MessageSquare size={16}/>}<span>{'noteTitle' in r.data ? r.data.noteTitle : r.data.feedbackSummary}<small>{new Date(r.createdAt).toLocaleDateString()} · {r.page.platform}</small></span><ArrowUpRight size={16}/></button>)}{!records.length && <div className="empty">你的下一条洞察，从这里开始。<small>保存的分析与选题会显示在这里</small></div>}<footer>CAPTURE. UNDERSTAND. ACT.<span>CLIP//AI V1.1.1</span></footer></motion.main>}
    {view === 'settings' && <main><div className="eyebrow">CONNECT YOUR AI</div><h1 className="compact">Make it <span>yours.</span></h1><p>使用自己的 OpenAI 或 DeepSeek 账户，开启你的洞察工作台。</p><section><h3><KeyRound size={16}/> AI Settings</h3><label className="field">AI Provider<select value={config.provider} disabled={!!busy} onChange={e => { const provider = e.target.value as Provider; setConfig({...config,provider,model:provider === "deepseek" ? "deepseek-flash" : defaults.model}); setKey(''); setModels([]); setConnected(hasKeys[provider]); }}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option></select></label><label className="field">API Key<input type="password" autoComplete="off" value={key} placeholder={connected ? '已配置 · 留空保留当前 Key' : 'sk-…'} onChange={e => setKey(e.target.value)}/></label><label className="field">Model<input value={config.model} list="models" onChange={e => setConfig({ ...config, model: e.target.value })}/><datalist id="models">{models.map(m => <option key={m} value={m}/>)}</datalist></label><button onClick={() => void run(async () => setModels(await call('models', {provider:config.provider,key})))}>获取账户模型列表</button><label className="check"><input type="checkbox" checked={config.remember} onChange={e => setConfig({ ...config, remember: e.target.checked })}/> Remember Key（此设备持久保存）</label><div className="actions"><button disabled={!!busy} onClick={() => void run(async () => { setBusy('TESTING CONNECTION…'); try {
        await call('test', { key, provider: config.provider, model: config.model, id: crypto.randomUUID() });
        setNotice('CONNECTION VERIFIED ✓');
    }
    finally {
        setBusy('');
    } })}>Test Connection</button><button className="primary" onClick={() => void run(async () => { await call('settings', { settings: config, key }); setConnected(!!key || connected); setHasKeys({...hasKeys,[config.provider]:!!key || connected}); setKey(''); setNotice('SETTINGS SAVED ✓'); setView('home'); })}>Initialize CLIP//AI</button></div><button className="danger" onClick={() => void run(async () => { await call('removeKey', {provider:config.provider}); setKey(''); setConnected(false); setHasKeys({...hasKeys,[config.provider]:false}); setNotice('API Key 已删除'); })}>Remove Key</button><p className="fine">内容会发送到当前选定的 AI 服务商，费用由你的 API 账户承担。Key 默认仅存当前浏览器会话；主动开启 Remember Key 才会保留。客户端存储无法提供服务器密钥管理级别的安全保障。</p></section><section><h3>Content Preferences</h3>{(['product', 'description', 'audience', 'goals'] as const).map((k, i) => <React.Fragment key={k}>{field(['Target Product Name', 'Product Description', 'Target Audience', 'Content Goals'][i], config.preferences[k], v => setConfig({ ...config, preferences: { ...config.preferences, [k]: v } }), true)}</React.Fragment>)}<p className="fine">这些资料用于 IDEA REMIX；请只填写产品已具备的功能。</p><label className="check"><input type="checkbox" checked={config.preferences.reducedMotion} onChange={e => setConfig({ ...config, preferences: { ...config.preferences, reducedMotion: e.target.checked } })}/> Reduced Motion</label><button onClick={() => void run(async () => { await call('settings', { settings: config, key }); setConnected(!!key || connected); setHasKeys({...hasKeys,[config.provider]:!!key || connected}); setKey(''); setNotice('偏好已保存'); })}>保存偏好</button></section><section><h3>Data Management</h3><button onClick={() => void run(async () => { downloadRecords(records); setNotice(records.length ? 'CSV 已生成' : '没有可导出的记录'); })}>Export Records</button><button className="danger" onClick={() => { if (confirm('确认清空所有本地记录？请先导出。'))
        void run(async () => { await call('clear'); setRecords([]); setNotice('记录已清空'); }); }}>Clear Local Records</button></section><footer>CLIP//AI · From Content to Insights.</footer></main>}
    {view === 'input' && <main><div className="eyebrow">{kind.toUpperCase()} RADAR / CAPTURE</div><h1 className="compact">Start with <span>{kind === 'content' ? 'content.' : 'a voice.'}</span></h1><p>检查并编辑待发送内容。请删除个人敏感信息、私人消息与企业机密。</p><section>{field('Title', page.title, v => setPage({ ...page, title: v }))}{field('Source URL', page.url, v => setPage({ ...page, url: v }))}{field('Source Platform', page.platform, v => setPage({ ...page, platform: v }))}<label className="field">{kind === 'content' ? 'CONTENT' : 'ORIGINAL FEEDBACK'}<textarea className="source" maxLength={kind === 'content' ? 18000 : 4000} value={page.text} placeholder="选择网页文字，或将内容粘贴到这里…" onChange={e => setPage({ ...page, text: e.target.value })}/><small>{page.text.length} 字符 · 仅发送你确认的文本</small></label><p className="fine">互动数据：未获取。采集时间：{new Date(page.capturedAt).toLocaleString()}。采集文字可能包含页面上的其他可见内容，请检查。</p><div className="actions"><button disabled={!!busy} onClick={() => void run(authorizeXiaohongshu)}>授权读取小红书</button><button disabled={!!busy} onClick={() => void run(() => capture(kind))}><ScanLine size={15}/>重新采集</button><button className="primary" disabled={!!busy} onClick={() => void run(analyze)}><Sparkles size={15}/>{kind === 'content' ? 'ANALYZE CONTENT' : 'EXTRACT INSIGHTS'}</button></div></section>{kind === 'content' && <p className="fine">IDEA REMIX 使用设置中的目标产品资料，资料不足会标记「待核实」。</p>}</main>}
    {view === 'preview' && data && <main><div className="eyebrow">ANALYSIS COMPLETE / PREVIEW</div><h1 className="compact">Ready for <span>action.</span></h1><p>所有字段可编辑。优先级与内容成效均为 AI 初步判断，需要人工核实。</p><label className="field">目标本地数据表<select value={kind} disabled><option value="content">Content Inspiration Database</option><option value="feedback">User Feedback Database</option></select></label><section><h3>{kind === 'content' ? 'CONTENT ANALYSIS' : 'FEEDBACK INSIGHT'}</h3>{renderFields(data as unknown as Record<string, unknown>, v => { setData(v as unknown as Analysis); setSaved(false); })}</section>{'ideas' in data && <><div className="section-title">IDEA REMIX ✨<span>3 NEW DIRECTIONS</span></div>{data.ideas.map((idea, i) => <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .1 }} key={i}><div className="section-title">IDEA 0{i + 1}<button title="复制选题" onClick={() => void run(() => copy(idea))}><Copy size={15}/></button></div>{renderFields(idea, v => { const ideas = [...data.ideas]; ideas[i] = v as unknown as typeof idea; setData({ ...data, ideas }); setSaved(false); })}<label className="check"><input type="checkbox" checked={selected.includes(i)} onChange={e => { setSelected(e.target.checked ? [...selected, i] : selected.filter(n => n !== i)); setSaved(false); }}/> Save this idea with source note</label></motion.section>)}</>}<div className="sticky"><button title="复制记录" onClick={() => void run(() => copy(data))}><Copy size={18}/></button><button className="primary" disabled={saved} onClick={() => void run(async () => { validate(kind, data); const r = await call<SavedRecord>('save', { kind, page, data, selectedIdeas: selected }); setRecords([r, ...records]); setSaved(true); setNotice('INSIGHT SAVED ✓'); })}><Check size={16}/>{saved ? 'INSIGHT SAVED' : 'SAVE TO DATABASE'}</button>{saved && <button title="导出当前记录" onClick={() => void run(async () => { const r = records.find(r => r.data === data) || records[0]; if (r)
        downloadRecords([r]); })}><Download size={18}/></button>}</div>{safeUrl(page.url) && <a className="source-link" href={safeUrl(page.url)} target="_blank" rel="noreferrer">查看原始来源 ↗</a>}<button className="back" onClick={() => setView('history')}>VIEW RECORDS →</button></main>}
    {view === 'history' && <main><div className="eyebrow">YOUR INSIGHT LIBRARY</div><h1 className="compact">Ideas, <span>collected.</span></h1><p>{records.length} / 200 条记录 · 保存在当前设备</p><button className="primary" onClick={() => void run(async () => { downloadRecords(records); setNotice(records.length ? 'CSV 已生成，请查看下载' : '暂无记录'); })}><Download size={16}/> EXPORT</button><p className="fine">导出已保存记录，方便后续整理与使用。</p>{records.map(r => <div className="history-row" key={r.id}><button className="record" onClick={() => openRecord(r)}><span>{'noteTitle' in r.data ? r.data.noteTitle : r.data.feedbackSummary}<small>{r.kind.toUpperCase()} · {new Date(r.createdAt).toLocaleString()}</small></span><ArrowUpRight size={16}/></button><button title="导出" onClick={() => void run(async () => downloadRecords([r]))}><Download size={16}/></button><button title="删除" onClick={() => void run(async () => { await call('delete', { id: r.id }); setRecords(records.filter(x => x.id !== r.id)); })}><Trash2 size={16}/></button></div>)}{!records.length && <div className="empty">还没有保存的记录。</div>}</main>}</div></MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<App />);
