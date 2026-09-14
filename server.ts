import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractReceiptFromImage, testMinimalExtraction } from './src/server/geminiExtractor.ts';
import { extractStatementFromPdfOrImage } from './src/server/statementAiExtractor.ts';
import { getModelRouterConfig, updateModelRouterConfig, resetModelRouterConfig } from './src/server/modelRouter.ts';
import { safeCleanBase64, safeString } from './src/utils/safeUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Increase payload limit for batch receipt image uploads (e.g. 50MB base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health & System Verification check
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasGeminiKey: hasKey,
    keyConfigured: hasKey,
    keyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
    modelRouter: getModelRouterConfig(),
    timestamp: new Date().toISOString(),
  });
});

// Model Router Configuration Endpoints
app.get('/api/model-config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: getModelRouterConfig(),
  });
});

app.post('/api/model-config', (req: Request, res: Response) => {
  const { primaryModel, escalationModel, fallbackCandidates, reset } = req.body || {};
  if (reset) {
    const config = resetModelRouterConfig();
    res.json({ success: true, message: 'Model router reset to defaults', config });
    return;
  }
  const updated = updateModelRouterConfig({
    ...(primaryModel ? { primaryModel: safeString(primaryModel) } : {}),
    ...(escalationModel ? { escalationModel: safeString(escalationModel) } : {}),
    ...(Array.isArray(fallbackCandidates) ? { fallbackCandidates } : {}),
  });
  res.json({ success: true, message: 'Model router updated successfully', config: updated });
});

// Diagnostic 5-Field Minimal Extraction Endpoint
app.post('/api/test-minimal-extraction', async (req: Request, res: Response): Promise<void> => {
  try {
    const { base64Data, image, mimeType, fileName } = req.body || {};
    const rawData = base64Data || image;

    if (!rawData) {
      res.status(400).json({
        success: false,
        error: 'Missing base64Data or image payload in request.',
        error_stage: 'image_ingestion',
        error_message: 'Missing base64Data or image payload in request.',
        error_timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log(`[Diagnostic API] Running minimal 5-field test for: ${fileName || 'receipt.jpg'}`);
    const result = await testMinimalExtraction(
      rawData,
      mimeType || 'image/jpeg',
      fileName || 'receipt.jpg'
    );

    res.json({
      success: true,
      rawResponse: result.rawResponseText,
      parsed: result.parsed,
      diagnostic: result.diagnostic,
    });
  } catch (error: any) {
    const errorStage = error?.stage || 'minimal_test';
    const isQuotaError = Boolean(error?.isQuotaError || /429|resource_exhausted|quota/i.test(error?.message || ''));
    const errorMessage = error?.message || 'Failed minimal extraction test';
    const failedModel = error?.failedModel || error?.lastModelAttempted || error?.modelUsed || 'gemini-3.8-flash';
    console.error(`[Diagnostic API] Error at stage "${errorStage}" (Model: ${failedModel}):`, error);
    res.status(isQuotaError ? 429 : 500).json({
      success: false,
      error: errorMessage,
      error_stage: errorStage,
      error_message: errorMessage,
      failed_model: failedModel,
      modelUsed: failedModel,
      isQuotaError,
      isRetryable: Boolean(error?.isRetryable || isQuotaError),
      httpStatus: isQuotaError ? 429 : 500,
      error_timestamp: new Date().toISOString(),
      stack: error?.stack,
    });
  }
});

// Full Single Receipt AI Extraction Endpoint
app.post('/api/extract-receipt', async (req: Request, res: Response): Promise<void> => {
  try {
    const { base64Data, image, mimeType, fileName } = req.body || {};
    const rawData = base64Data || image;

    if (!rawData) {
      res.status(400).json({
        success: false,
        error: 'Missing base64Data or image in request payload',
        error_stage: 'image_ingestion',
        error_message: 'Missing base64Data or image in request payload',
        error_timestamp: new Date().toISOString(),
      });
      return;
    }

    const cleanBase64 = safeCleanBase64(rawData);
    const safeFileName = safeString(fileName) || 'receipt.jpg';
    console.log(`[Extract API] Received request for "${safeFileName}" (${Math.round((cleanBase64.length * 0.75) / 1024)} KB)`);

    const result = await extractReceiptFromImage(
      cleanBase64,
      mimeType || 'image/jpeg',
      safeFileName
    );

    console.log(`[Extract API] Extraction SUCCESS for "${safeFileName}". Model: "${result.debugInfo?.modelUsed}"`);

    res.json({
      success: true,
      result,
      data: result.data,
      payment_transactions: result.payment_transactions || result.data?.payment_transactions || [],
      modelUsed: result.debugInfo?.modelUsed,
      isEscalated: result.debugInfo?.isEscalated,
      fieldConfidences: result.fieldConfidences,
      confidenceScores: result.fieldConfidences,
      overallConfidence: result.overallConfidence,
      uncertainFields: result.uncertainFields,
      notes: result.extractionNotes,
      internalSchema: result.internalSchema,
      debugInfo: result.debugInfo,
      fields_needing_review: result.fields_needing_review,
      extraction_warnings: result.extraction_warnings,
    });
  } catch (error: any) {
    const errorStage = error?.stage || 'extraction';
    const isQuotaError = Boolean(error?.isQuotaError || /429|resource_exhausted|quota/i.test(error?.message || ''));
    const errorMessage = error?.message || 'Failed to extract receipt data using Gemini AI';
    const failedModel = error?.failedModel || error?.lastModelAttempted || error?.modelUsed || 'gemini-3.8-flash';
    console.error(`[Extract API] Extraction error at stage "${errorStage}" (Model: ${failedModel}):`, error);
    res.status(isQuotaError ? 429 : 500).json({
      success: false,
      error: errorMessage,
      error_stage: errorStage,
      error_message: errorMessage,
      failed_model: failedModel,
      modelUsed: failedModel,
      isQuotaError,
      isRetryable: Boolean(error?.isRetryable || isQuotaError),
      httpStatus: isQuotaError ? 429 : 500,
      error_timestamp: new Date().toISOString(),
      stack: error?.stack,
    });
  }
});

// Bank Statement PDF/Image AI Extraction Endpoint
app.post('/api/extract-bank-statement', async (req: Request, res: Response): Promise<void> => {
  try {
    const { base64Data, file, mimeType, fileName, userEmail, fileId } = req.body || {};
    const rawData = base64Data || file;

    if (!rawData) {
      res.status(400).json({
        success: false,
        error: 'Missing base64Data or file in request payload',
      });
      return;
    }

    const safeFileName = safeString(fileName) || 'statement.pdf';
    const safeFileId = safeString(fileId) || `stmt_${Date.now()}`;
    const safeMime = safeString(mimeType) || 'application/pdf';
    console.log(`[Bank Statement API] Parsing PDF/Image statement "${safeFileName}" via Gemini AI`);

    const result = await extractStatementFromPdfOrImage(
      rawData,
      safeMime,
      safeFileName,
      safeString(userEmail) || 'finance_team',
      safeFileId
    );

    console.log(`[Bank Statement API] SUCCESS for "${safeFileName}". Extracted ${result.transactions.length} transactions.`);
    res.json({
      success: true,
      statementSummary: result.statementSummary,
      transactions: result.transactions,
      sampleRows: result.sampleRows,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('[Bank Statement API] Error parsing statement:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to extract bank statement using Gemini AI',
      stack: error?.stack,
    });
  }
});

// Serve static frontend files in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

// Only listen if not loaded by testing/vite
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hostel Receipt AI server listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
