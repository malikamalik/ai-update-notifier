export const updates = [
  // ── February 15, 2026 ──
  {
    id: 2,
    provider: "kimi",
    headline: "Kimi Claw: Build AI Agents in Your Browser with 5,000+ Skills",
    summary:
      "Kimi Claw lets you build and run AI agents entirely in your browser — no Docker, no local setup. Browse 5,000+ pre-built skills in ClawHub, chain them into complex workflows, and use 40GB of cloud storage for data-heavy tasks. Pro-Grade Search pulls real-time data from sources like Yahoo Finance.",
    date: "2026-02-15",
    isNew: false,
    link: "https://www.marktechpost.com/2026/02/15/moonshot-ai-launches-kimi-claw-native-openclaw-on-kimi-com-with-5000-community-skills-and-40gb-cloud-storage-now/",
    source: "MarkTechPost",
  },

  // ── February 12, 2026 ──
  {
    id: 4,
    provider: "openai",
    headline: "GPT-5.3-Codex-Spark: Real-Time AI Coding at 1,000+ Tokens/sec",
    summary:
      "ChatGPT Pro users get GPT-5.3-Codex-Spark, a speed-optimized coding model that generates code at over 1,000 tokens per second with a 128K context window. Powered by Cerebras WSE-3 hardware — OpenAI's first model not running on Nvidia. Available as a research preview for real-time AI pair-programming.",
    date: "2026-02-12",
    isNew: false,
    link: "https://openai.com/index/introducing-gpt-5-3-codex-spark/",
    source: "OpenAI",
  },

  // ── February 11, 2026 ──
  {
    id: 1,
    provider: "deepseek",
    headline: "DeepSeek Expands Context Window to 1M Tokens",
    summary:
      "DeepSeek silently expanded its production model's context window from 128K to 1M tokens — a nearly 10x jump. Officially acknowledged as a 'long-text model test,' it lets you upload and analyze massive documents, entire codebases, or lengthy research papers in a single prompt. The expansion uses Sparse Attention to keep responses fast.",
    date: "2026-02-11",
    isNew: false,
    link: "https://www.scmp.com/tech/tech-trends/article/3343225/deepseek-boosts-ai-model-10-fold-token-addition-zhipu-ai-gears-glm-5-launch",
    source: "South China Morning Post",
  },

  // ── February 5, 2026 ──
  {
    id: 6,
    provider: "anthropic",
    headline: "Claude Opus 4.6: Agent Teams & PowerPoint Add-in",
    summary:
      "Claude's new Agent Teams feature splits large tasks into parallel sub-jobs handled by coordinated agents — so complex research, coding, or analysis finishes much faster. A new PowerPoint add-in lets you build presentations directly with Claude in a side panel, available in research preview for Max, Team, and Enterprise plans.",
    date: "2026-02-05",
    isNew: false,
    link: "https://techcrunch.com/2026/02/05/anthropic-releases-opus-4-6-with-new-agent-teams/",
    source: "TechCrunch",
  },

  // ── February 5, 2026 ──
  {
    id: 5,
    provider: "perplexity",
    headline: "Model Council: Run 3 AI Models at Once for Higher-Confidence Answers",
    summary:
      "Perplexity Max users can now use Model Council, which runs three frontier models simultaneously (e.g. Claude Opus 4.6, GPT-5.2, Gemini 3 Pro) on your question, then a synthesizer resolves conflicts and presents a unified, higher-confidence answer. Available on web for Max subscribers.",
    date: "2026-02-05",
    isNew: false,
    link: "https://www.perplexity.ai/hub/blog/introducing-model-council",
    source: "Perplexity",
  },

  // ── January 28, 2026 ──
  {
    id: 10,
    provider: "xai",
    headline: "Grok Imagine API: Video & Audio Generation from Text and Images",
    summary:
      "xAI launches the Grok Imagine API, enabling video and audio generation from text or images. Restyle scenes, edit objects, and control motion through the API. Paired with Grok Voice (launched Dec 2025) for natural conversations, and the Grok 4.1 Thinking variant which reached #1 on LM Arena.",
    date: "2026-01-28",
    isNew: false,
    link: "https://x.ai/news/grok-imagine-api",
    source: "xAI",
  },

  // ── January 27, 2026 ──
  {
    id: 8,
    provider: "kimi",
    headline: "Kimi K2.5: Open-Source 1T Multimodal Model",
    summary:
      "Kimi K2.5 is a 1 trillion parameter open-source MoE model (~32B active per expert) that handles text and images natively, pretrained on 15 trillion tokens. It outperforms GPT-5.2 on agentic and vision benchmarks (BrowseComp 74.9% vs 57.8%). Released under Modified MIT License — download, fine-tune, and deploy it, though the full model requires 600GB+.",
    date: "2026-01-27",
    isNew: false,
    link: "https://siliconangle.com/2026/01/27/moonshot-ai-releases-open-source-kimi-k2-5-model-1t-parameters/",
    source: "SiliconANGLE",
  },

  // ── January 12, 2026 ──
  {
    id: 9,
    provider: "adobe",
    headline: "Adobe Firefly Adds GPT-Image 1.5 + Unlimited AI Generation",
    summary:
      "Adobe Firefly integrated OpenAI's GPT-Image 1.5 alongside its own models, so you can generate images using multiple AI engines in one place. Subscribers get unlimited image gen (up to 2K) and video gen through a limited-time promotion. Describe what you want and pick the best result from different AI models side by side.",
    date: "2026-01-12",
    isNew: false,
    link: "https://9to5mac.com/2026/01/12/adobe-firefly-gets-gpt-image-1-5-support-and-temporary-unlimited-image-generation/",
    source: "9to5Mac",
  },

  // ── January 9, 2026 ──
  {
    id: 13,
    provider: "midjourney",
    headline: "Niji V7: Improved Anime Coherence, Prompt Understanding & Text Rendering",
    summary:
      "Niji V7 brings a major coherency boost for anime and illustration — fine details like eyes, reflections, and backgrounds are significantly improved. Sref performance is better, and you can use V7 sref codes with Style Creator. Ships as Midjourney's most significant model update before the upcoming V8.",
    date: "2026-01-09",
    isNew: false,
    link: "https://updates.midjourney.com/niji-v7/",
    source: "Midjourney",
  },

  // ── December 17, 2025 ──
  {
    id: 3,
    provider: "gemini",
    headline: "Gemini 3 Flash: Fast Pro-Grade Reasoning Now Default in Gemini App",
    summary:
      "Gemini 3 Flash is now the default model in the Gemini app and AI Mode in Search, giving you Pro-level reasoning at Flash-level speed. It scores 90.4% on GPQA Diamond and 33.7% on Humanity's Last Exam without tools. Smarter answers in Google Search, Docs, and the Gemini app without switching models.",
    date: "2025-12-17",
    isNew: false,
    link: "https://blog.google/products/gemini/gemini-3-flash/",
    source: "Google Blog",
  },

  // ── December 11, 2025 ──
  {
    id: 7,
    provider: "microsoft",
    headline: "Microsoft 365 Copilot Gets GPT-5.2",
    summary:
      "Microsoft 365 Copilot now uses GPT-5.2 across Windows, Mac, iOS, Android, and Web, with a 30% reduction in factual errors and better instruction-following, math, and coding. Available to all Copilot for Microsoft 365 users.",
    date: "2025-12-11",
    isNew: false,
    link: "https://www.microsoft.com/en-us/microsoft-365/blog/2025/12/11/available-today-gpt-5-2-in-microsoft-365-copilot/",
    source: "Microsoft 365 Blog",
  },

  // ── December 10, 2025 ──
  {
    id: 11,
    provider: "figma",
    headline: "Figma Launches AI-Powered Object Removal & Image Extension",
    summary:
      "Figma added three new AI image tools: Erase Object removes unwanted elements, Isolate Object separates subjects for editing, and Expand Image extends backgrounds for new formats. All work directly on the canvas with point-and-click — no text prompts needed.",
    date: "2025-12-10",
    isNew: false,
    link: "https://techcrunch.com/2025/12/10/figma-launches-new-ai-powered-object-removal-and-image-extension/",
    source: "TechCrunch",
  },

  // ── December 10, 2025 ──
  {
    id: 17,
    provider: "uxpilot",
    headline: "UX Pilot: Predictive Heatmaps & Auto Design Reviews",
    summary:
      "UX Pilot generates predictive heatmaps showing where users will look and click on your designs, plus automated heuristic reviews that catch accessibility and usability issues before you build. Integrates directly with Figma and claims to cut concept-to-implementation time by up to 80%. Over 1M+ designs created on the platform.",
    date: "2025-12-10",
    isNew: false,
    link: "https://uxpilot.ai/",
    source: "UX Pilot",
  },

  // ── December 4, 2025 ──
  {
    id: 15,
    provider: "gemini",
    headline: "Gemini 3 Deep Think: Advancing Science, Research & Engineering",
    summary:
      "Gemini 3 Deep Think uses advanced parallel reasoning to explore multiple hypotheses simultaneously, delivering significantly better answers on hard science, research, and engineering questions. It scores 41% on Humanity's Last Exam and 45.1% on ARC-AGI-2. Available to Google AI Ultra subscribers in the Gemini app.",
    date: "2025-12-04",
    isNew: false,
    link: "https://blog.google/products/gemini/gemini-3-deep-think/",
    source: "Google Blog",
  },

  // ── December 2, 2025 ──
  {
    id: 12,
    provider: "mistral",
    headline: "Mistral Large 3: 675B MoE Model at a Fraction of GPT-5.2 Cost",
    summary:
      "Mistral Large 3 (675B total, 41B active MoE) delivers near-GPT-5.2 quality at roughly 11-29% the cost depending on input/output ratio. Launched alongside Ministral 3 (3B/8B/14B dense models) that run on single GPUs for on-device AI. Best value play for teams wanting powerful AI on a budget or self-hosting.",
    date: "2025-12-02",
    isNew: false,
    link: "https://mistral.ai/news/mistral-3",
    source: "Mistral AI",
  },

  // ── April 5, 2025 ──
  {
    id: 16,
    provider: "meta",
    headline: "Llama 4: Open-Weight Multimodal AI Models",
    summary:
      "Llama 4 handles text, images, and video natively in Scout (109B total / 17B active, 16 experts) and Maverick (400B total / 17B active, 128 experts). Scout features a 10M token context window; Maverick has 1M. Open-weight under the Llama 4 Community License (commercial license needed above 700M MAU).",
    date: "2025-04-05",
    isNew: false,
    link: "https://ai.meta.com/blog/llama-4-multimodal-intelligence/",
    source: "Meta AI",
  },
];
