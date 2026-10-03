import { KnowledgeStore } from './knowledge/knowledge.store.js';
import { AiTools } from './ai.tools.js';
import {
  BE11_SYSTEM_PROMPT,
  detectPromptInjection,
  isHumanEscalationRequested,
  sanitizeUserInput,
} from './ai.prompts.js';
import { AiAnalytics } from './ai.analytics.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface ChatRequest {
  message: string;
  conversationId?: string;
  pageContext?: {
    route?: string;
    page?: string;
    venueId?: string;
    matchId?: string;
    sport?: string;
  };
  userId?: string;
  userRole?: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  category: string;
  escalationRequired: boolean;
  escalationInfo?: {
    whatsappUrl: string;
    emailUrl: string;
    whatsappNumber: string;
    supportEmail: string;
  };
  dataPayload?: any;
  sources?: string[];
  latencyMs: number;
}

export class AiService {
  private static instance: AiService;
  private knowledgeStore: KnowledgeStore;
  private analytics: AiAnalytics;

  public constructor() {
    this.knowledgeStore = KnowledgeStore.getInstance();
    this.analytics = AiAnalytics.getInstance();
  }

  public static getInstance(): AiService {
    if (!AiService.instance) {
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  /**
   * Main chat completion handler.
   */
  public async handleChat(req: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const conversationId = req.conversationId || `conv_${Date.now()}`;
    const sanitizedMessage = sanitizeUserInput(req.message);

    // 1. Prompt Injection Protection
    if (detectPromptInjection(sanitizedMessage)) {
      const latency = Date.now() - startTime;
      this.analytics.recordEvent({
        category: 'Security',
        resolved: false,
        escalated: false,
        latencyMs: latency,
        route: req.pageContext?.route,
        userRole: req.userRole,
      });

      return {
        message:
          "I am the BE11 Support Assistant and can only assist with verified BE11 platform questions, venue reservations, live matches, and sports features.",
        conversationId,
        category: 'Security',
        escalationRequired: false,
        latencyMs: latency,
      };
    }

    // 2. Explicit Human Escalation Request
    if (isHumanEscalationRequested(sanitizedMessage)) {
      const latency = Date.now() - startTime;
      const escalationInfo = this.buildEscalationPayload(sanitizedMessage);

      this.analytics.recordEvent({
        category: 'Admin/Support',
        resolved: true,
        escalated: true,
        latencyMs: latency,
        route: req.pageContext?.route,
        userRole: req.userRole,
      });

      return {
        message:
          "I'd be glad to connect you with BE11 Human Support! Our team is available 24x7 to assist you:\n\n- **WhatsApp Support**: +91 87001 90843\n- **Email Support**: support@be11.in\n\nYou can also click the direct contact buttons below to start a chat or compose an email with your issue details.",
        conversationId,
        category: 'Admin/Support',
        escalationRequired: true,
        escalationInfo,
        latencyMs: latency,
      };
    }

    // 3. Detect Intent & Category
    const intent = this.detectIntent(sanitizedMessage, req.pageContext);

    // 4. Execute Dynamic Database Tools based on Intent
    let toolResult: any = null;
    let category = intent.category;

    if (intent.action === 'getUserBookings') {
      if (!req.userId) {
        const latency = Date.now() - startTime;
        return {
          message:
            "Please [log in to your BE11 account](/login) to view your personal reservations and booking history.",
          conversationId,
          category: 'Account',
          escalationRequired: false,
          latencyMs: latency,
        };
      }
      toolResult = await AiTools.getUserBookings(req.userId);
    } else if (intent.action === 'getUserWallet') {
      if (!req.userId) {
        const latency = Date.now() - startTime;
        return {
          message:
            "Please [log in to your BE11 account](/login) to view your wallet balance and recent ledger transactions.",
          conversationId,
          category: 'Wallet',
          escalationRequired: false,
          latencyMs: latency,
        };
      }
      toolResult = await AiTools.getUserWallet(req.userId);
    } else if (intent.action === 'getUserNotifications') {
      if (!req.userId) {
        const latency = Date.now() - startTime;
        return {
          message:
            "Please [log in to your BE11 account](/login) to view your personal notifications.",
          conversationId,
          category: 'Notifications',
          escalationRequired: false,
          latencyMs: latency,
        };
      }
      toolResult = await AiTools.getUserNotifications(req.userId);
    } else if (intent.action === 'getLiveMatches') {
      toolResult = await AiTools.getLiveMatches({ sport: intent.params?.sport });
    } else if (intent.action === 'getVenues') {
      toolResult = await AiTools.getVenues();
    } else if (intent.action === 'getVenueDetails' && intent.params?.venueKey) {
      toolResult = await AiTools.getVenueDetails(intent.params.venueKey);
    } else if (intent.action === 'searchProducts') {
      toolResult = await AiTools.searchProducts({ query: intent.params?.query });
    } else if (intent.action === 'getCoaches') {
      toolResult = await AiTools.getCoaches();
    }

    // 5. Retrieve RAG Knowledge Items
    let ragMatches =
      intent.category && intent.category !== 'General BE11'
        ? this.knowledgeStore.search(sanitizedMessage, 3, intent.category)
        : [];
    if (ragMatches.length === 0) {
      ragMatches = this.knowledgeStore.search(sanitizedMessage, 3);
    }
    const ragContext = ragMatches.map((m) => `[${m.item.title}]\n${m.item.content}`).join('\n\n');
    const sources = ragMatches.map((m) => m.item.source);

    // 6. Unknown / Unverified Question Check (Anti-Hallucination)
    if (intent.action === 'unknown') {
      const latency = Date.now() - startTime;
      const escalationInfo = this.buildEscalationPayload(sanitizedMessage);

      this.analytics.recordEvent({
        category: 'Unknown',
        resolved: false,
        escalated: true,
        latencyMs: latency,
        route: req.pageContext?.route,
        userRole: req.userRole,
      });

      return {
        message:
          "I don't have enough verified information to answer that accurately. BE11 offers cricket grounds, live matches, 3D jersey customization, kits, toss, and coaching. Would you like to check with BE11 Support?",
        conversationId,
        category: 'Unknown',
        escalationRequired: true,
        escalationInfo,
        latencyMs: latency,
      };
    }

    // 7. Generate Response (LLM or High-Performance Built-in Reasoning Engine)
    let responseText = '';
    const isHinglish = this.isHinglishInput(sanitizedMessage);

    const apiKey = (env as any).GEMINI_API_KEY || (env as any).AI_API_KEY || (env as any).OPENAI_API_KEY;

    if (apiKey) {
      try {
        responseText = await this.callExternalLlm({
          apiKey,
          userPrompt: sanitizedMessage,
          ragContext,
          liveData: toolResult?.data,
          isHinglish,
          pageContext: req.pageContext,
        });
      } catch (llmErr) {
        logger.warn('External LLM call failed, falling back to built-in reasoning:', llmErr);
        responseText = this.synthesizeBuiltInAnswer({
          intent,
          toolResult,
          ragMatches,
          isHinglish,
          pageContext: req.pageContext,
        });
      }
    } else {
      responseText = this.synthesizeBuiltInAnswer({
        intent,
        toolResult,
        ragMatches,
        isHinglish,
        pageContext: req.pageContext,
      });
    }

    const latency = Date.now() - startTime;

    this.analytics.recordEvent({
      category,
      resolved: true,
      escalated: false,
      latencyMs: latency,
      route: req.pageContext?.route,
      userRole: req.userRole,
    });

    return {
      message: responseText,
      conversationId,
      category,
      escalationRequired: false,
      dataPayload: toolResult?.data,
      sources,
      latencyMs: latency,
    };
  }

  /**
   * Deterministic Intent Detector recognizing English, Hindi, and Hinglish.
   */
  private detectIntent(
    message: string,
    pageContext?: { route?: string; venueId?: string; matchId?: string }
  ): { category: string; action: string; params?: Record<string, any> } {
    const text = message.toLowerCase();

    // Check for Unknown / Hallucination-inducing concepts
    const unknownIndicators = [
      'swimming',
      'pool',
      'badminton',
      'tennis court',
      'basketball',
      'golf club membership',
      'hockey stick',
      'table tennis',
      'billiards',
      'horse riding',
      'fake ground',
      'fake venue',
      'non-existent',
      "doesn't exist",
      'does not exist',
      'not exist',
      'unknown venue',
    ];
    if (unknownIndicators.some((u) => text.includes(u))) {
      return { category: 'Unknown', action: 'unknown' };
    }

    // Context resolution for "this venue" or "price of this"
    let targetVenueKey = '';
    if (text.includes('rrr') || text.includes('kidawali')) {
      targetVenueKey = 'rrr-cricket-club-kidawali-faridabad';
    } else if (text.includes('playnow')) {
      targetVenueKey = 'playnow-cricket-ground';
    } else if (text.includes('ab ground') || text.includes('ab cricket') || text.includes('bajaj')) {
      targetVenueKey = 'ab-cricket-ground';
    } else if (pageContext?.route?.includes('/venues/')) {
      targetVenueKey = pageContext.venueId || pageContext.route.split('/venues/')[1] || '';
    }

    // 1. Personal User Data Intents (Authenticated)
    if (text.includes('my booking') || text.includes('meri booking') || text.includes('mera reservation')) {
      return { category: 'Bookings', action: 'getUserBookings' };
    }
    if (
      text.includes('my wallet') ||
      text.includes('wallet balance') ||
      text.includes('kitne paise') ||
      text.includes('mera balance') ||
      text.includes('wallet me balance')
    ) {
      return { category: 'Wallet', action: 'getUserWallet' };
    }
    if (text.includes('notification') || text.includes('notif') || text.includes('alerts')) {
      return { category: 'Notifications', action: 'getUserNotifications' };
    }

    // 2. Live Matches Intents
    if (
      text.includes('live match') ||
      text.includes('cricket match') ||
      text.includes('match open') ||
      text.includes('open match') ||
      text.includes('spots left') ||
      text.includes('spots available') ||
      text.includes('kitne spot') ||
      text.includes('kitne players') ||
      text.includes('match hai kya') ||
      text.includes('join a match') ||
      text.includes('join match') ||
      text.includes('entry fee')
    ) {
      const sport = text.includes('football') ? 'Football' : 'Cricket';
      return { category: 'Live Matches', action: 'getLiveMatches', params: { sport } };
    }

    // 3. Venues / Grounds Intents
    if (targetVenueKey) {
      return { category: 'Venues', action: 'getVenueDetails', params: { venueKey: targetVenueKey } };
    }
    if (
      text.includes('venues') ||
      text.includes('grounds') ||
      text.includes('ground available') ||
      text.includes('kaha khel sakte') ||
      text.includes('which ground') ||
      text.includes('konsa ground')
    ) {
      return { category: 'Venues', action: 'getVenues' };
    }

    // 4. Booking Flow & Instructions
    if (
      text.includes('how to book') ||
      text.includes('booking kaise') ||
      text.includes('book kaise kare') ||
      text.includes('book a venue') ||
      text.includes('book individually')
    ) {
      return { category: 'Venue Booking', action: 'knowledgeLookup' };
    }

    // 5. Payment & Failed Payment Intents
    if (
      text.includes('payment') ||
      text.includes('failed') ||
      text.includes('deducted') ||
      text.includes('paise kat gaye') ||
      text.includes('pay kaise') ||
      text.includes('razorpay') ||
      text.includes('upi')
    ) {
      return { category: 'Payments', action: 'knowledgeLookup' };
    }

    // 6. Account & Authentication Intents
    if (
      text.includes('email') ||
      text.includes('phone') ||
      text.includes('mobile') ||
      text.includes('otp') ||
      text.includes('password') ||
      text.includes('signup') ||
      text.includes('register') ||
      text.includes('login')
    ) {
      return { category: 'Account', action: 'knowledgeLookup' };
    }

    // 7. Special Sports Features
    if (text.includes('jersey') || text.includes('jersey builder') || text.includes('custom jersey')) {
      return { category: 'Jersey Builder', action: 'knowledgeLookup' };
    }
    if (text.includes('kit') || text.includes('kit builder') || text.includes('cricket kit')) {
      return { category: 'Kit Builder', action: 'knowledgeLookup' };
    }
    if (text.includes('toss') || text.includes('coin toss') || text.includes('coin flip')) {
      return { category: 'Toss', action: 'knowledgeLookup' };
    }
    if (text.includes('capture') || text.includes('recording') || text.includes('highlights')) {
      return { category: 'Add Ons', action: 'knowledgeLookup' };
    }
    if (text.includes('coach') || text.includes('academy') || text.includes('training')) {
      return { category: 'Coaches', action: 'getCoaches' };
    }
    if (text.includes('store') || text.includes('shop') || text.includes('buy bat') || text.includes('buy ball')) {
      return { category: 'Store', action: 'searchProducts', params: { query: 'bat' } };
    }
    if (text.includes('cancellation') || text.includes('refund') || text.includes('cancel')) {
      return { category: 'Cancellations & Refunds', action: 'knowledgeLookup' };
    }

    // 8. General BE11 Questions
    return { category: 'General BE11', action: 'knowledgeLookup' };
  }

  /**
   * High-accuracy built-in answer synthesis (offline/deterministic fallback).
   */
  private synthesizeBuiltInAnswer(opts: {
    intent: { category: string; action: string; params?: any };
    toolResult?: any;
    ragMatches: any[];
    isHinglish: boolean;
    pageContext?: any;
  }): string {
    const { intent, toolResult, ragMatches, isHinglish } = opts;

    // A. Personal Bookings
    if (intent.action === 'getUserBookings') {
      const bookings = toolResult?.data?.bookings || [];
      if (bookings.length === 0) {
        return isHinglish
          ? "Aapke account me abhi koi active bookings nahi hain. Aap [Venues page](/venues) par jakar ground book kar sakte hain!"
          : "You currently have no bookings on BE11. You can explore available venues and reserve a slot on the [Venues page](/venues).";
      }
      const list = bookings
        .map(
          (b: any) =>
            `- **${b.venue}** on **${b.date}** (${b.time || b.matchPeriod}) — ₹${b.totalPrice} [Status: **${b.status}**]`
        )
        .join('\n');
      return isHinglish
        ? `Aapki recent bookings:\n\n${list}\n\nSabhi details dekhne ke liye [My Bookings](/my-bookings) visit karein.`
        : `Here are your recent bookings:\n\n${list}\n\nView complete details in [My Bookings](/my-bookings).`;
    }

    // B. Personal Wallet
    if (intent.action === 'getUserWallet') {
      const balance = toolResult?.data?.walletBalance ?? 0;
      return isHinglish
        ? `Aapka current BE11 Wallet balance **₹${balance.toFixed(2)}** hai.\n\nWallet recharge karne ke liye [Profile Settings](/settings) me jaayein.`
        : `Your current BE11 Wallet balance is **₹${balance.toFixed(2)}**.\n\nYou can top up your balance via UPI or cards in [Profile Settings](/settings).`;
    }

    // C. Live Matches (Queries real DB)
    if (intent.action === 'getLiveMatches') {
      const matches = toolResult?.data?.matches || [];
      const total = toolResult?.data?.totalOpenMatches ?? 0;
      if (total === 0) {
        return isHinglish
          ? "Filhal koi open live match available nahi hai. Aap [Venues](/venues) par jakar khud ka ground book kar sakte hain!"
          : "There are currently no open live matches. Check back soon or book an entire ground on the [Venues page](/venues).";
      }
      const matchLines = matches
        .map(
          (m: any) =>
            `- **${m.sport} at ${m.venue}** (${m.venueCity})\n  Date: **${m.date}** | Time: **${m.time}**\n  Entry Fee: **₹${m.entryFee}** per player | **${m.spotsLeft} spots left** (${m.playersJoined}/${m.totalPlayers} joined)`
        )
        .join('\n\n');
      return isHinglish
        ? `Abhi BE11 par **${total} live match open** hain:\n\n${matchLines}\n\nKisi bhi match ko join karne ke liye [Live Matches](/live-matches) par jaayein!`
        : `There are currently **${total} open live matches** on BE11:\n\n${matchLines}\n\nJoin any lobby directly from the [Live Matches page](/live-matches).`;
    }

    // D. Specific Venue Details (RRR, Playnow, AB Ground)
    if (intent.action === 'getVenueDetails') {
      const v = toolResult?.data;
      if (!v) {
        return "I couldn't locate that specific venue. Please browse all verified grounds at [Venues](/venues).";
      }

      if (v.slug === 'rrr-cricket-club-kidawali-faridabad') {
        return isHinglish
          ? `**RRR Cricket Club Kidawali Faridabad**:\n- **Location**: Kidawali, Pusta Road, Faridabad\n- **Owner**: Rishi (+91 97116 69718)\n- **3 Fixed Match Periods**:\n  1. Morning: 06:00 AM – 10:00 AM\n  2. Afternoon: 10:00 AM – 02:00 PM\n  3. Evening: 02:00 PM – 06:00 PM\n- **Pricing** (Promo: *BE11 WELCOMES*):\n  - Individual: **₹299** (Display ₹373.75 - ₹74.75 off)\n  - Half Team: **₹2,600** (Display ₹3,250 - ₹650 off)\n  - Entire Venue: **₹5,000** (Display ₹6,250 - ₹1,250 off)\n\n[Book RRR Cricket Club](/venues/rrr-cricket-club-kidawali-faridabad)`
          : `**RRR Cricket Club Kidawali Faridabad**:\n- **Location**: Kidawali, Pusta Road, Faridabad\n- **Owner**: Rishi (+91 97116 69718)\n- **Match Periods**:\n  - Morning Match: 06:00 AM – 10:00 AM\n  - Afternoon Match: 10:00 AM – 02:00 PM\n  - Evening Match: 02:00 PM – 06:00 PM\n- **Official Pricing** (Includes 25% discount with code *BE11 WELCOMES*):\n  - **Individual**: ₹299 (from ₹373.75)\n  - **Half Team (Team of 11)**: ₹2,600 (from ₹3,250)\n  - **Entire Venue**: ₹5,000 (from ₹6,250)\n\n[Book RRR Cricket Club](/venues/rrr-cricket-club-kidawali-faridabad)`;
      }

      if (v.slug === 'playnow-cricket-ground') {
        return isHinglish
          ? `**Playnow Cricket Ground (Gurugram)**:\n- **Location**: Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102\n- **Owner**: Aanurag Jain (+91 95992 80399)\n- **Weekday Pricing** (Both Teams):\n  - Morning (07:00 – 11:30 AM): **₹5,000** Entire / **₹2,500** Team of 11\n  - Afternoon (12:00 – 04:30 PM): **₹5,000** Entire / **₹2,500** Team of 11\n  - Night (08:00 – 11:30 PM): **₹10,000** Entire / **₹5,000** Team of 11\n- **Weekend Pricing** (Saturday & Sunday):\n  - Morning (07:00 – 11:30 AM): **₹10,000** Entire / **₹5,000** Team of 11\n  - Afternoon (12:00 – 04:30 PM): **₹5,000** Entire / **₹2,500** Team of 11\n  - Day-Night (04:30 – 08:00 PM): **₹10,000** Entire / **₹5,000** Team of 11 (*Weekends only*)\n  - Night (08:00 – 11:30 PM): **₹11,000** Entire / **₹5,500** Team of 11\n\n[Book Playnow Cricket Ground](/venues/playnow-cricket-ground)`
          : `**Playnow Cricket Ground** (Gurugram):\n- **Location**: Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102\n- **Owner**: Aanurag Jain (+91 95992 80399)\n- **Weekday Rates** (Both Teams):\n  - Morning (07:00 – 11:30 AM): ₹5,000 Entire / ₹2,500 Team of 11\n  - Afternoon (12:00 – 04:30 PM): ₹5,000 Entire / ₹2,500 Team of 11\n  - Night (08:00 – 11:30 PM): ₹10,000 Entire / ₹5,000 Team of 11\n- **Weekend Rates** (Saturday – Sunday):\n  - Morning (07:00 – 11:30 AM): ₹10,000 Entire / ₹5,000 Team of 11\n  - Afternoon (12:00 – 04:30 PM): ₹5,000 Entire / ₹2,500 Team of 11\n  - Day-Night (04:30 – 08:00 PM): ₹10,000 Entire / ₹5,000 Team of 11 (Weekends Only)\n  - Night (08:00 – 11:30 PM): ₹11,000 Entire / ₹5,500 Team of 11\n\n[Book Playnow Cricket Ground](/venues/playnow-cricket-ground)`;
      }

      if (v.slug === 'ab-cricket-ground') {
        return isHinglish
          ? `**AB Cricket Ground** (Faridabad):\n- **Location**: New Industrial Town, Aravalli Golf Course precinct, Faridabad (Plus Code: 97PW+V69)\n- **Owner**: Rajesh Bajaj (+91 95402 28222)\n- **Match Packages**:\n  - **Standard Match Package** (Morning/Afternoon): **₹3,500** Whole Ground (Umpires, scorers, balls, nets, drinking water included)\n  - **Extended Floodlit Match Package** (Night): **₹6,500** Whole Ground with floodlights, pavilion & cafeteria access\n  - Single Team of 11: Price on request directly with Rajesh Bajaj\n\n[Book AB Cricket Ground](/venues/ab-cricket-ground)`
          : `**AB Cricket Ground** (Faridabad):\n- **Location**: New Industrial Town, Aravalli Golf Course precinct, Faridabad (Plus Code: 97PW+V69)\n- **Owner**: Rajesh Bajaj (+91 95402 28222)\n- **Packages**:\n  - **Standard Match Package** (Day 07:00-11:30 AM or 12:00-04:30 PM): **₹3,500** Whole Ground\n  - **Extended Day / Floodlit Match Package** (Night 06:00-10:30 PM): **₹6,500** Whole Ground with floodlights & cafeteria access\n  - Single Team of 11: Price on request directly with venue owner.\n\n[Book AB Cricket Ground](/venues/ab-cricket-ground)`;
      }
    }

    // E. General Venues List
    if (intent.action === 'getVenues') {
      const venues = toolResult?.data?.venues || [];
      const list = venues
        .map((v: any) => `- **${v.name}** in ${v.city} (${v.sport}) — [View Ground](${v.url})`)
        .join('\n');
      return isHinglish
        ? `BE11 par ye verified cricket venues available hain:\n\n${list}\n\nSlot booking ke liye [Venues](/venues) par jaayein.`
        : `BE11 features these verified sports grounds:\n\n${list}\n\nExplore slot availability on the [Venues catalog](/venues).`;
    }

    // F. Fallback to top RAG match
    if (ragMatches.length > 0) {
      const topMatch = ragMatches[0].item;
      return topMatch.content;
    }

    // Default polite response
    return isHinglish
      ? "Main BE11 ke venues, live matches, jersey builder, payments aur account me aapki help kar sakta hu. Aap kya janna chahte hain?"
      : "I can assist you with BE11 venues, match bookings, live games, custom jerseys, payments, and account questions. What would you like to know?";
  }

  /**
   * External LLM caller for Google Gemini or OpenAI-compatible endpoint.
   */
  private async callExternalLlm(opts: {
    apiKey: string;
    userPrompt: string;
    ragContext: string;
    liveData?: any;
    isHinglish: boolean;
    pageContext?: any;
  }): Promise<string> {
    const { apiKey, userPrompt, ragContext, liveData, isHinglish, pageContext } = opts;

    const fullPrompt = `${BE11_SYSTEM_PROMPT}

CURRENT ACTIVE CONTEXT:
${pageContext ? `Current Route: ${pageContext.route || 'Home'} | Venue: ${pageContext.venueId || 'None'}` : ''}

VERIFIED LIVE DATABASE DATA:
${liveData ? JSON.stringify(liveData, null, 2) : 'No direct tool payload needed.'}

KNOWLEDGE BASE CONTEXT (RAG):
${ragContext || 'None'}

USER QUERY:
${userPrompt}

LANGUAGE REQUIREMENT:
${isHinglish ? 'Respond in natural, conversational Hinglish (Hindi written in Roman script).' : 'Respond in clear, professional English.'}

Respond directly, concisely, and helpfully. Never hallucinate non-existent features or prices.`;

    // Try Gemini API if key is Gemini format or default
    const isGemini = apiKey.startsWith('AIza') || (env as any).GEMINI_API_KEY;

    if (isGemini) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) return generatedText.trim();
    }

    // Try OpenAI-compatible endpoint
    const openAiUrl = 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(openAiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: BE11_SYSTEM_PROMPT },
          { role: 'user', content: fullPrompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  private isHinglishInput(text: string): boolean {
    const hinglishMarkers = [
      'kaise',
      'kare',
      'karu',
      'karna',
      'hai kya',
      'kaha',
      'kitna',
      'kitne',
      'chahiye',
      'bataye',
      'mujhe',
      'mera',
      'meri',
      'paise',
      'hoga',
      'hogi',
      'nahi',
      'sakta',
      'khel',
      'sakte',
    ];
    const lower = text.toLowerCase();
    return hinglishMarkers.some((marker) => lower.includes(marker));
  }

  private buildEscalationPayload(userQuery: string) {
    const encodedSummary = encodeURIComponent(`Hi BE11 Support, I need help with: ${userQuery}`);
    const emailSubject = encodeURIComponent('BE11 Support Request');
    const emailBody = encodeURIComponent(`Hi BE11 Support Team,\n\nI need help regarding: ${userQuery}\n\nThank you.`);

    return {
      whatsappNumber: '+91 87001 90843',
      supportEmail: 'support@be11.in',
      whatsappUrl: `https://wa.me/918700190843?text=${encodedSummary}`,
      emailUrl: `mailto:support@be11.in?subject=${emailSubject}&body=${emailBody}`,
    };
  }
}
