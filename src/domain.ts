import { z } from 'zod';
const text = z.string().max(4000);
const tags = z.array(z.string().max(100)).max(20);
export const ideaSchema = z.object({ topicTitle: text, targetAudience: text, userPainPoint: text, contentAngle: text, suggestedStructure: text, suggestedHook: text, recommendedProductScenario: text, whyThisIdeaFits: text });
export const contentSchema = z.object({ noteTitle: text, contentCategory: text, topicTags: tags, targetAudience: text, coreMessage: text, hookAnalysis: text, contentStructure: text, writingStyle: text, audiencePainPoint: text, contentHighlights: text, engagementMechanism: text, whyItWorks: text, reusableContentPattern: text, potentialApplication: text, inspirationSummary: text, ideas: z.array(ideaSchema).length(3) });
export const feedbackSchema = z.object({ originalFeedback: text, feedbackSummary: text, feedbackType: z.enum(['Bug', 'Feature Request', 'Usability Issue', 'Performance', 'Documentation', 'Positive Feedback', 'Other']), productModule: text, userScenario: text, userPainPoint: text, potentialRequirement: text, sentiment: z.enum(['Positive', 'Neutral', 'Negative', 'Mixed']), suggestedImprovement: text, confidenceLevel: z.enum(['High', 'Medium', 'Low', 'Needs More Context']), prioritySuggestion: z.enum(['High', 'Medium', 'Low', 'Needs More Context']), priorityReason: text, status: z.literal('Pending Review'), tags });
export type Kind = 'content' | 'feedback';
export type Analysis = z.infer<typeof contentSchema> | z.infer<typeof feedbackSchema>;
export interface PageData {
    title: string;
    url: string;
    platform: string;
    text: string;
    capturedAt: string;
    tags: string[];
    likes: null;
    favorites: null;
    comments: null;
}
export interface Preferences {
    product: string;
    description: string;
    audience: string;
    goals: string;
    reducedMotion: boolean;
}
export type Provider = 'openai' | 'deepseek';
export interface Settings {
    provider: Provider;
    model: string;
    remember: boolean;
    preferences: Preferences;
}
export interface SavedRecord {
    id: string;
    kind: Kind;
    createdAt: string;
    page: Omit<PageData, 'text'>;
    data: Analysis;
    ideaIds: string[];
    selectedIdeas: number[];
}
export const defaults: Settings = { provider: 'openai', model: 'gpt-4.1-mini', remember: false, preferences: { product: '', description: '', audience: '', goals: '', reducedMotion: false } };
export function validate(kind: Kind, data: unknown): Analysis { return (kind === 'content' ? contentSchema : feedbackSchema).parse(data); }
export function createRecord(kind: Kind, data: Analysis, page: PageData, selectedIdeas = [0, 1, 2]): SavedRecord { validate(kind, data); const { text: _, ...meta } = page; return { id: crypto.randomUUID(), kind, data, page: meta, createdAt: new Date().toISOString(), ideaIds: Array.from({ length: 3 }, () => crypto.randomUUID()), selectedIdeas }; }
export const safeUrl = (url: string) => { try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.href : '';
}
catch {
    return '';
} };
