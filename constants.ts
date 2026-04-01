import { ClientProfile, ContentPiece, Stats } from './types';

export const CLIENT_PROFILES: Record<string, ClientProfile> = {
  ai_architect: {
    id: 'ai_architect',
    name: 'Tu Nombre',
    role: 'Arquitecto de IA B2B y Sistemas de Automatización',
    avatar: 'TU_URL_DE_AVATAR',
    tone: 'Pragmático, Desafiante y Ejecutivo',
    nicheKeywords: [
      'Inteligencia Artificial B2B', 
      'Automatización de Operaciones', 
      'Agentes de IA', 
      'Make n8n arquitectura', 
      'Prospección Outbound B2B IA', 
      'Sistemas de filtrado cognitivo'
    ],
    targetCreators: [
      'https://www.linkedin.com/in/drake-surach',
      'https://www.linkedin.com/in/aditi-jain-ai-automation',
      'https://www.linkedin.com/in/khushpreet-kaur-3b4146229',
      'https://www.linkedin.com/in/ruben-hassid',
      'https://www.linkedin.com/in/anaguerraia',
      'https://www.linkedin.com/in/luke-pierce-boom-automations'
    ],
    customInstructions: `
      Eres un Arquitecto de Sistemas e IA escribiendo para CEOs, Founders de agencias y Consultores B2B. 
      Tu tono es de ingeniero hablando con un CEO: directo, pragmático, al grano y contraintuitivo.
      CERO EDULCORADO. CERO HUMO. No te disculpas por vender. Eres un experto en rentabilidad y eficiencia operativa.
      
      REGLAS ESTRICTAS:
      1. Odias los saludos corporativos falsos. Nunca empieces con "Espero que estés bien".
      2. Odias el exceso de emojis emocionales. Usa solo estos de forma funcional: 👉, 🏗️, ⚙️, 🧠, 🎯, 📈.
      3. Cero hashtags genéricos innecesarios.
      4. Fomenta opiniones polémicas (ej: "Usar Make sin arquitectura es basura").
      5. Formatos: Listas accionables de alto nivel (arquitectura, no tutoriales básicos) y casos de uso de desmontaje de procesos (ej: 8 horas manuales vs 1 hora con IA).
      6. Usa estas palabras/frases clave cuando sea natural: "Infraestructura técnica", "Colador cognitivo", "Fronteras de contexto", "Trabajo sucio", "Sistemas vs. Tutoriales".
      7. OBLIGATORIO: Termina SIEMPRE el post con la frase "A construir." o "A seguir construyendo."
    `,
  },
};

export const MOCK_STATS: Record<string, Stats> = {
  ai_architect: {
    impressions: 8900,
    postsReady: 5,
    ideasGenerated: 24,
    engagementRate: 2.8,
  },
};

export const INITIAL_CONTENT: ContentPiece[] = [
  {
    id: 'idea-1',
    sourceType: 'creator_reference',
    originalAuthor: 'Drake Surach',
    originalUrl: 'https://linkedin.com/...',
    originalText: "Most businesses don't need more SaaS, they need better architecture to connect the ones they have.",
    viralMetrics: { likes: 850, comments: 132 },
    tags: ['Arquitectura', 'Contraintuitivo'],
    status: 'idea',
    targetDate: new Date(Date.now() + 86400000).toISOString(),
    generatedDraft: {
      hook: "Tu stack tecnológico de 15 herramientas SaaS te está costando dinero y agilidad.",
      body: "El 90% de las agencias apilan herramientas (Make, ChatGPT, HubSpot) sin una infraestructura central.\n\nResultado: Silos de información y procesos rotos.\n\nLa IA no soluciona el caos, lo acelera. Necesitas arquitectura, no un tutorial de Zapier.\n\nA construir.",
      cta: "Si quieres ver cómo diseñamos fronteras de contexto para escalar, envíame un DM.",
      researchNotes: ["SaaS vs Arquitectura", "Problemas de escala en Agencias"],
      viralityAnalysis: {
        viralityReason: "Desmitifica la idea de que 'más herramientas = mejor' y ataca la desorganización de los CEOs.",
        bottleneck: "Requiere conocimiento técnico para implementar.",
        engagement_trigger: "Debate sobre herramientas no-code vs arquitectura real.",
        audience_relevance: "CEOs técnicos y dueños de agencias escalando."
      }
    },
    aiAnalysis: {
        hook: { type: "Urgency", text: "🚨 Tu contenido de IA está matando el tráfico de tu web", effectiveness: 85, why_it_works: "Aversión a la pérdida" },
        virality_score: { overall: 85, verdict: "High Probability" }
    }
  }
];