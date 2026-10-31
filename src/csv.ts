import type { SavedRecord } from './domain';
export function csvCell(value: unknown): string { let s = value == null ? '' : Array.isArray(value) ? value.join(' | ') : String(value); if (/^[\s\u0000-\u0020]*[=+@\-]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }
export function toCsv(rows: Record<string, unknown>[], headers: string[]): string { return '\uFEFF' + [headers, ...rows.map(row => headers.map(h => row[h]))].map(r => r.map(csvCell).join(',')).join('\r\n'); }
export function exportTables(records: SavedRecord[]) {
    const notes: Record<string, unknown>[] = [], ideas: Record<string, unknown>[] = [], feedback: Record<string, unknown>[] = [];
    for (const r of records) {
        const base = { ID: r.id, 'Source Platform': r.page.platform, 'Source URL': r.page.url, 'Capture Date': r.page.capturedAt, 'Created At': r.createdAt };
        if ('ideas' in r.data) {
            const d = r.data;
            notes.push({ ...base, Title: d.noteTitle, 'Content Category': d.contentCategory, 'Target Audience': d.targetAudience, 'Hook Analysis': d.hookAnalysis, 'Content Highlights': d.contentHighlights, 'User Pain Point': d.audiencePainPoint, Tags: d.topicTags, Status: 'Pending Review', 'Core Message': d.coreMessage, 'Content Structure': d.contentStructure, 'Writing Style': d.writingStyle, 'Engagement Mechanism': d.engagementMechanism, 'Why It Works': d.whyItWorks, 'Reusable Content Pattern': d.reusableContentPattern, 'Potential Application': d.potentialApplication, 'Inspiration Summary': d.inspirationSummary });
            d.ideas.forEach((i, n) => { if (r.selectedIdeas.includes(n))
                ideas.push({ ID: r.ideaIds[n], 'Source Note ID': r.id, 'Idea Title': i.topicTitle, 'Idea Description': i.contentAngle, 'Recommended Scenario': i.recommendedProductScenario, 'Target Audience': i.targetAudience, 'User Pain Point': i.userPainPoint, 'Suggested Structure': i.suggestedStructure, 'Suggested Hook': i.suggestedHook, 'Why This Idea Fits': i.whyThisIdeaFits, Status: 'Pending Review', 'Created At': r.createdAt }); });
        }
        else {
            const d = r.data;
            feedback.push({ ...base, 'Original Feedback': d.originalFeedback, 'Feedback Summary': d.feedbackSummary, 'Feedback Type': d.feedbackType, 'Product Module': d.productModule, 'User Scenario': d.userScenario, 'Pain Point': d.userPainPoint, 'Potential Requirement': d.potentialRequirement, Sentiment: d.sentiment, 'Suggested Improvement': d.suggestedImprovement, 'Confidence Level': d.confidenceLevel, 'Priority Suggestion': d.prioritySuggestion, 'Priority Reason': d.priorityReason, Status: d.status, Tags: d.tags });
        }
    }
    return [{ name: 'content-research', rows: notes }, { name: 'content-ideas', rows: ideas }, { name: 'user-feedback', rows: feedback }].filter(t => t.rows.length).map(t => ({ ...t, csv: toCsv(t.rows, Object.keys(t.rows[0])) }));
}
export function downloadRecords(records: SavedRecord[]) { for (const t of exportTables(records)) {
    const url = URL.createObjectURL(new Blob([t.csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clip-ai-${t.name}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
} }
