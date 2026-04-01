export type SourceType = 'creator_reference' | 'keyword_search' | 'user_audio';
export type ContentStatus = 'idea' | 'drafted' | 'approved' | 'posted';
export type ClientPersona = 'psychologist' | 'seo_consultor' | 'ai_architect';

export interface ViralMetrics {
  likes: number;
  comments: number;
  shares?: number;
}

export interface ViralityAnalysis {
  viralityReason: string; // Por qué podría volverse viral
  bottleneck: string; // El cuello de botella del post - qué lo limita
  engagement_trigger: string; // Qué genera engagement
  audience_relevance: string; // Relevancia para la audiencia
}

export interface GeneratedDraft {
  hook: string;
  body: string;
  cta: string;
  researchNotes: string[];
  viralityAnalysis?: ViralityAnalysis; // Nuevo: análisis profesional de viralidad
}

export interface ContentPiece {
  id: string;
  sourceType: SourceType;
  originalUrl?: string;
  sourceUrl?: string;
  originalText?: string; // The "Source Material"
  originalAuthor?: string;
  viralMetrics?: ViralMetrics;

  generatedDraft: GeneratedDraft;
  aiAnalysis?: {
    hook?: { type?: string; text?: string; effectiveness?: number; why_it_works?: string };
    narrative_arc?: { structure?: string; phases?: string[]; turning_point?: string };
    emotional_triggers?: { primary_emotion?: string; secondary_emotions?: string[]; emotional_journey?: string };
    persuasion_techniques?: { techniques_used?: Array<{ name: string; example: string; impact: string }>; social_proof?: string; authority_signals?: string };
    engagement_mechanics?: { why_people_comment?: string; debate_potential?: number; shareability?: number; save_worthy?: number; call_to_action?: string };
    virality_score?: { overall?: number; originality?: number; relatability?: number; actionability?: number; controversy?: number; verdict?: string };
    structural_blueprint?: { total_lines?: string; line_length_pattern?: string; use_of_whitespace?: string; formatting?: string[]; rhythm?: string };
    replication_strategy?: string;
  };

  status: ContentStatus;
  targetDate?: string; // ISO string
  tags: string[]; // e.g., "Viral Reference", "News Based"
  feedback?: 'like' | 'dislike';
}

export interface ClientProfile {
  id: ClientPersona;
  name: string;
  role: string;
  avatar: string;
  tone: string; // e.g., "Empathetic", "Authoritative"
  nicheKeywords: string[];
  targetCreators: string[];
  customInstructions: string;
}

export interface Stats {
  impressions: number;
  postsReady: number;
  ideasGenerated: number;
  engagementRate: number;
}