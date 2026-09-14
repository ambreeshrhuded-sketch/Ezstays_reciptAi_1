import { GoogleGenAI } from '@google/genai';
import { safeString } from '../utils/safeUtils';

export interface ModelRouterConfig {
  /** The standard default primary model used for all receipt extraction tasks */
  primaryModel: string;
  /** The controlled fallback model used when primary fails or produces invalid extraction */
  escalationModel: string;
  /** Ordered list of candidate models for fallback failover */
  fallbackCandidates: string[];
  /** Maximum retry attempts for the primary model after a transient failure */
  maxRetriesPerModel: number;
  /** Milliseconds delay before transient retry */
  retryDelayMs: number;
  /** Timeout in ms for the primary model */
  primaryTimeoutMs: number;
  /** Timeout in ms for a fallback model */
  fallbackTimeoutMs: number;
}

/**
 * Production Model Routing Configuration
 * Primary: gemini-3.1-flash-lite (Ultra-fast latency and high throughput for instant receipt extraction)
 * Escalation: gemini-flash-latest (Reliable failover alias)
 * Fallback Candidates: gemini-3.8-flash, gemini-2.5-flash
 */
const DEFAULT_ROUTER_CONFIG: ModelRouterConfig = {
  primaryModel: 'gemini-3.1-flash-lite',
  escalationModel: 'gemini-flash-latest',
  fallbackCandidates: ['gemini-3.8-flash', 'gemini-2.5-flash'],
  maxRetriesPerModel: 1,
  retryDelayMs: 600,
  primaryTimeoutMs: 12000,
  fallbackTimeoutMs: 15000,
};

let activeRouterConfig: ModelRouterConfig = { ...DEFAULT_ROUTER_CONFIG };

// Track models that have exceeded their daily/minute quota to avoid wasting calls on them
const exhaustedModels = new Map<string, number>();

export function isModelExhausted(model: string): boolean {
  const expiresAt = exhaustedModels.get(model);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    exhaustedModels.delete(model);
    return false;
  }
  return true;
}

export function markModelExhausted(model: string, cooldownMinutes = 15): void {
  console.warn(`[ModelRouter] Marking model "${model}" as temporarily quota-exhausted for ${cooldownMinutes} minutes.`);
  exhaustedModels.set(model, Date.now() + cooldownMinutes * 60 * 1000);
}

export function clearModelExhaustion(model?: string): void {
  if (model) {
    exhaustedModels.delete(model);
  } else {
    exhaustedModels.clear();
  }
}

/**
 * Detects if an error is due to rate limits (429) or quota exhaustion
 */
export function isQuotaOrRateLimitError(err: any): boolean {
  const text = `${String(err?.message || '')} ${String(err?.status || '')} ${String(err?.code || '')} ${JSON.stringify(err?.details || '')}`.toLowerCase();
  return /429|resource_exhausted|quota exceeded|too many requests|rate limit/i.test(text);
}

/**
 * Parses any retry delay recommendation from Gemini error response
 */
export function parseRetryDelayMs(err: any): number | null {
  const text = `${String(err?.message || '')} ${JSON.stringify(err?.details || '')}`;
  const match = text.match(/retry\s+in\s+([\d.]+)\s*s/i);
  if (match) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.min(Math.round(sec * 1000), 20000);
    }
  }
  return null;
}

/**
 * Cleans ugly RPC / JSON error messages into concise, human-readable strings
 */
export function formatAiErrorMessage(err: any, model?: string): string {
  const raw = err?.message || String(err || '');
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error && parsed.error.message) {
      const msg = parsed.error.message;
      if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
        const retryMatch = msg.match(/retry\s+in\s+([\d.]+s)/i);
        const retry = retryMatch ? ` Please retry in ${retryMatch[1]}.` : '';
        return `Gemini API quota or rate limit reached for ${model || 'model'}.${retry}`;
      }
      return msg.split('\n')[0];
    }
  } catch {}

  if (/429|resource_exhausted|quota exceeded/i.test(raw)) {
    const retryMatch = raw.match(/retry\s+in\s+([\d.]+s)/i);
    const retry = retryMatch ? ` Please retry in ${retryMatch[1]}.` : '';
    return `Gemini API quota or rate limit reached for ${model || 'model'}.${retry}`;
  }

  return raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;
}

/**
 * Returns the current active model router configuration
 */
export function getModelRouterConfig(): Readonly<ModelRouterConfig> {
  return { ...activeRouterConfig };
}

/**
 * Updates the model router configuration at runtime
 */
export function updateModelRouterConfig(newConfig: Partial<ModelRouterConfig>): ModelRouterConfig {
  const primaryModel = safeString(newConfig.primaryModel) || activeRouterConfig.primaryModel;
  const escalationModel = safeString(newConfig.escalationModel) || activeRouterConfig.escalationModel;
  const requestedFallbacks = Array.isArray(newConfig.fallbackCandidates)
    ? newConfig.fallbackCandidates.map((model) => safeString(model)).filter(Boolean)
    : activeRouterConfig.fallbackCandidates;

  activeRouterConfig = {
    ...activeRouterConfig,
    ...newConfig,
    primaryModel,
    escalationModel,
    fallbackCandidates: [...new Set(requestedFallbacks)].filter(
      (model) => model !== primaryModel
    ),
  };
  return { ...activeRouterConfig };
}

/**
 * Resets the model router configuration to default settings
 */
export function resetModelRouterConfig(): ModelRouterConfig {
  activeRouterConfig = { ...DEFAULT_ROUTER_CONFIG };
  exhaustedModels.clear();
  return { ...activeRouterConfig };
}

/**
 * Provides client factory with environment key verification and compliant User-Agent
 */
export function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ModelRoutingRequest {
  requestParts: any[];
  responseMimeType?: string;
  forceModel?: string;
  contextLabel?: string;
  validateOutput?: (parsedOrRaw: any) => boolean;
}

export interface ModelRoutingResponse {
  text: string;
  modelUsed: string;
  isEscalated: boolean;
  attempts: number;
  executionTimeMs: number;
  routingLog: string[];
}

/**
 * Helper to execute a single model call with an exact timeout
 */
async function callModelWithTimeout(
  ai: GoogleGenAI,
  model: string,
  requestParts: any[],
  responseMimeType: string,
  timeoutMs: number
): Promise<string> {
  let timerId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Model call to "${model}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const config: any = {
      responseMimeType: responseMimeType as any,
    };
    // For 2.5 models disable thinking budget for faster pure OCR
    if (/2\.5/i.test(model)) {
      config.thinkingConfig = {
        thinkingBudget: 0,
      };
    }

    const apiCallPromise = ai.models.generateContent({
      model,
      contents: requestParts,
      config,
    }).then((res) => {
      const txt = safeString(res.text);
      if (!txt) {
        throw new Error(`Empty response received from model "${model}"`);
      }
      return txt;
    });

    return await Promise.race([apiCallPromise, timeoutPromise]);
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Routes one request through the primary model and, when needed, fallback candidates.
 * Prioritizes high-quota production models and gracefully handles 429 quota exhaustion.
 */
export async function routeGeneration(
  request: ModelRoutingRequest,
  aiClient?: GoogleGenAI
): Promise<ModelRoutingResponse> {
  const startTime = Date.now();
  const ai = aiClient || getAiClient();
  const routingLog: string[] = [];
  const {
    requestParts,
    responseMimeType = 'application/json',
    forceModel,
    contextLabel,
    validateOutput,
  } = request;

  const receiptId = contextLabel || 'receipt-unknown';
  console.log(`[Gemini] Receipt extraction started for "${receiptId}"`);
  routingLog.push(`[Gemini] Receipt extraction started for "${receiptId}"`);

  // If manual single model override requested
  if (forceModel) {
    const model = forceModel;
    const timeoutMs = activeRouterConfig.primaryTimeoutMs;
    console.log(`[Gemini] Model override: ${model}`);
    const t0 = Date.now();
    try {
      const text = await callModelWithTimeout(ai, model, requestParts, responseMimeType, timeoutMs);
      if (validateOutput && !validateOutput(text)) {
        throw new Error(`Model "${model}" returned an invalid extraction response`);
      }
      const elapsed = Date.now() - t0;
      console.log(`[Gemini] Completed in: ${elapsed} ms`);
      console.log('[Gemini] Validation: PASS');
      console.log('[Gemini] Final result: success');
      return {
        text,
        modelUsed: model,
        isEscalated: false,
        attempts: 1,
        executionTimeMs: Date.now() - startTime,
        routingLog,
      };
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      console.log(`[Gemini] Completed in: ${elapsed} ms`);
      console.log('[Gemini] Validation: FAIL');
      console.log('[Gemini] Final result: failure');
      (err as any).failedModel = model;
      (err as any).modelUsed = model;
      (err as any).isQuotaError = isQuotaOrRateLimitError(err);
      throw err;
    }
  }

  const isTransientServerError = (err: any) => {
    const text = `${String(err?.message || '')} ${String(err?.status || '')} ${String(err?.code || '')}`.toLowerCase();
    return /503|500|502|504|unavailable|high demand|timeout|timed out|network|fetch|econnreset|etimedout|overloaded/i.test(text);
  };

  const isRetryableError = (err: any) => {
    return isTransientServerError(err);
  };

  const isValidOutput = (text: string) => {
    if (!validateOutput) return true;
    try {
      return validateOutput(text);
    } catch {
      return false;
    }
  };

  const callAndValidate = async (model: string, timeoutMs: number) => {
    const text = await callModelWithTimeout(ai, model, requestParts, responseMimeType, timeoutMs);
    if (!isValidOutput(text)) {
      throw new Error(`Model "${model}" returned an invalid extraction response`);
    }
    return text;
  };

  // Build candidate models sequence
  // If a model is known to have exceeded daily quota (e.g. 20 requests limit reached),
  // place it at the very end of fallback list so we don't waste time failing on it.
  const rawCandidateList = [
    activeRouterConfig.primaryModel,
    activeRouterConfig.escalationModel,
    ...activeRouterConfig.fallbackCandidates,
  ];

  const uniqueModels = Array.from(new Set(rawCandidateList.filter(Boolean)));
  // Separate available models from known quota-exhausted models
  const availableModels = uniqueModels.filter((m) => !isModelExhausted(m));
  const candidateModels = availableModels.length > 0
    ? [...availableModels, ...uniqueModels.filter((m) => isModelExhausted(m))]
    : uniqueModels;

  let totalAttempts = 0;
  let lastError: any = null;
  let lastModelAttempted = candidateModels[0] || 'gemini-3.8-flash';

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const isPrimary = mIdx === 0;
    const timeoutMs = isPrimary ? activeRouterConfig.primaryTimeoutMs : activeRouterConfig.fallbackTimeoutMs;

    console.log(`[Gemini] ${isPrimary ? 'Primary Model' : 'Candidate Model'}: ${currentModel}`);
    routingLog.push(`[Gemini] Model: ${currentModel}`);

    const maxAttemptsForModel = isPrimary ? (activeRouterConfig.maxRetriesPerModel + 1) : 1;

    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      totalAttempts++;
      lastModelAttempted = currentModel;
      const t0 = Date.now();

      try {
        const text = await callAndValidate(currentModel, timeoutMs);
        const elapsed = Date.now() - t0;
        console.log(`[Gemini] ${currentModel} completed in: ${elapsed} ms`);
        console.log('[Gemini] Validation: PASS');
        routingLog.push(`[Gemini] ${currentModel} completed in: ${elapsed} ms`);
        routingLog.push('[Gemini] Validation: PASS');

        return {
          text,
          modelUsed: currentModel,
          isEscalated: !isPrimary,
          attempts: totalAttempts,
          executionTimeMs: Date.now() - startTime,
          routingLog,
        };
      } catch (err: any) {
        lastError = err;
        const elapsed = Date.now() - t0;
        const cleanMsg = formatAiErrorMessage(err, currentModel);
        console.log(`[Gemini] ${currentModel} failed in: ${elapsed} ms (attempt ${attempt}): ${cleanMsg}`);
        routingLog.push(`[Gemini] ${currentModel} failed in: ${elapsed} ms (${cleanMsg})`);

        // Check if error is quota exhaustion on a specific model metric
        const isQuotaErr = isQuotaOrRateLimitError(err);
        if (isQuotaErr && /quota exceeded for metric|generate_content_free_tier_requests/i.test(String(err?.message || ''))) {
          markModelExhausted(currentModel, 20);
          // Don't retry this model, break immediately to try next candidate
          break;
        }

        // If retryable server transient error on primary model, do a short backoff
        if (attempt < maxAttemptsForModel && isRetryableError(err)) {
          const backoffDelay = Math.min(
            activeRouterConfig.retryDelayMs * Math.pow(1.5, attempt - 1) + Math.floor(Math.random() * 300),
            3000
          );
          console.log(`[Gemini] Retrying ${currentModel} in ${backoffDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        // Move to next candidate model
        break;
      }
    }
  }

  console.log('[Gemini] Final result: failure');
  routingLog.push('[Gemini] Final result: failure');
  const cleanErrMsg = formatAiErrorMessage(lastError, lastModelAttempted);
  const finalErr = new Error(`Receipt extraction failed after ${totalAttempts} attempt(s): ${cleanErrMsg}`);
  (finalErr as any).stage = 'gemini_response';
  (finalErr as any).routingLog = routingLog;
  (finalErr as any).totalAttempts = totalAttempts;
  (finalErr as any).failedModel = lastModelAttempted;
  (finalErr as any).modelUsed = lastModelAttempted;
  (finalErr as any).isQuotaError = isQuotaOrRateLimitError(lastError);
  (finalErr as any).isRetryable = isQuotaOrRateLimitError(lastError) || isTransientServerError(lastError);
  throw finalErr;
}
