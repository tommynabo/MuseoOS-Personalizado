import { ClientProfile, ContentPiece, Stats } from './types';

export const CLIENT_PROFILES: Record<string, ClientProfile> = {
  seo_consultor: {
    id: 'seo_consultor',
    name: 'MuseOS',
    role: 'Consultoría SEO / Coaching de Negocios',
    avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200',
    tone: 'Directo y Pragmático',
    nicheKeywords: ['Consultoría SEO', 'Agencia B2B', 'Coaching High Ticket', 'Comunidad Skool', 'Automatización B2B', 'Scaling', 'Lead Gen'],
    targetCreators: ['https://linkedin.com/in/marcvidal', 'https://linkedin.com/in/samovens', 'https://linkedin.com/in/alexhormozi'],
    customInstructions: "Analiza el perfil del creador/consultor y el tipo de servicio o comunidad que ofrece. Redacta una línea de apertura que conecte su nicho específico con el cuello de botella de escalar operaciones online sin quemarse respondiendo mensajes manuales. No repitas su titular. Demuestra inteligencia comercial.\n\nPúblico Objetivo: Emprendedores digitales, Infoproductores, Coaches High Ticket, Consultores online y Dueños de Comunidades (Discord/Skool). Negocios 100% online saturados de trabajo manual.\nObjetivo del Mensaje: Vender el siguiente paso (agendar llamada rápida o enviar vídeo de Loom/Miro demostrativo).\nTono: Directo, pragmático, de igual a igual (de creador a creador). Cero humo. Sin saludos corporativos vacíos.",
  },
};

export const MOCK_STATS: Record<string, Stats> = {
  seo_consultor: {
    impressions: 8900,
    postsReady: 5,
    ideasGenerated: 24,
    engagementRate: 2.8,
  },
};

export const INITIAL_CONTENT: ContentPiece[] = [
  // Scenario A: SEO/B2B News
  {
    id: 'idea-1',
    sourceType: 'keyword_search',
    originalAuthor: 'Google Core Updates',
    originalUrl: 'https://developers.google.com/search',
    originalText: "Google ha lanzado una nueva core update que prioriza el contenido de experiencia real (E-E-A-T) reduciendo el spam generado por IA sin aportar valor.",
    viralMetrics: { likes: 450, comments: 120 },
    tags: ['Noticia', 'SEO'],
    status: 'idea',
    targetDate: new Date(Date.now() + 86400000).toISOString(),
    generatedDraft: {
      hook: "🚨 Tu contenido de IA está matando el tráfico de tu web.",
      body: "Muchos agencias siguen delegando todo el SEO a la IA masiva. Esto es un error que te puede costar la invisibilidad en Google.\n\nLa nueva actualización prioriza la experiencia humana y el 'E-E-A-T'.\n\nEjemplo: Si tu post es solo un refrito de ChatGPT sin insight real, perderás posiciones rápidamente frente a voces con autoridad.",
      cta: "Si dudas cómo adaptar tu estrategia de content a las nuevas reglas, envíame un DM y revisamos un vídeo donde te explico el proceso.",
      researchNotes: ["Google E-E-A-T", "Actualización Core Marzo"],
      viralityAnalysis: {
        viralityReason: "El contenido genera un miedo legítimo a la pérdida de tráfico orgánico.",
        bottleneck: "Alerta sin exagerar, apuntando al dolor.",
        engagement_trigger: "El CTA invita a un vídeo de Loom de mucho valor.",
        audience_relevance: "Relevante para dueños de agencias, e-commerces y consultorías."
      }
    },
    aiAnalysis: {
        hook: { type: "Urgency", text: "🚨 Tu contenido de IA está matando el tráfico de tu web", effectiveness: 85, why_it_works: "Aversión a la pérdida" },
        virality_score: { overall: 85, verdict: "High Probability" }
    }
  },
  // Scenario B: Consulting Wisdom
  {
    id: 'idea-2',
    sourceType: 'creator_reference',
    originalAuthor: 'Consultor B2B',
    originalText: "Vender barato atrae peores clientes. Escala tus precios y la calidad aumentará sola.",
    viralMetrics: { likes: 15000, comments: 800 },
    tags: ['Ventas', 'Mentalidad'],
    status: 'drafted',
    targetDate: new Date(Date.now() + 172800000).toISOString(),
    generatedDraft: {
      hook: "¿Sigues vendiendo servicios baratos y sufriendo con clientes que exigen demasiado?",
      body: "Con el modelo actual de agencias de bajo ticket, cada nuevo cliente es un problema más, no un avance.\n\nNo se trata de trabajar más duro, se trata de reestructurar la oferta.\n\nEl salto High Ticket soluciona los problemas de retención y el dolor de cabeza.",
      cta: "Tengo un vídeo corto demostrando cómo mi equipo filtró los leads. Dime si quieres que te lo mande.",
      researchNotes: ["Estrategias High Ticket", "Filtrado de Leads B2B"],
      viralityAnalysis: {
        viralityReason: "Toca el dolor profundo de estar saturado de clientes malos.",
        bottleneck: "Debes aportar pasos claros o un recurso después.",
        engagement_trigger: "Pregunta del cuello de botella en su agencia.",
        audience_relevance: "Totalmente en línea con dueños de agencias B2B y coaches."
      }
    },
    aiAnalysis: {
        hook: { type: "Question", text: "¿Sigues vendiendo servicios baratos...?", effectiveness: 75, why_it_works: "Toca el dolor central de las agencias" },
        virality_score: { overall: 70, verdict: "Medium Probability" }
    }
  },
];