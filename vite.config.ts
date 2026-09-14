import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

let geminiExtractorModule: any = null;
async function getGeminiExtractor() {
  if (!geminiExtractorModule) {
    geminiExtractorModule = await import('./src/server/geminiExtractor.ts');
  }
  return geminiExtractorModule;
}

let statementExtractorModule: any = null;
async function getStatementExtractor() {
  if (!statementExtractorModule) {
    statementExtractorModule = await import('./src/server/statementAiExtractor.ts');
  }
  return statementExtractorModule;
}

let modelRouterModule: any = null;
async function getModelRouter() {
  if (!modelRouterModule) {
    modelRouterModule = await import('./src/server/modelRouter.ts');
  }
  return modelRouterModule;
}

function apiPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/extract-receipt') && req.method === 'POST') {
          try {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            });
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                const parsed = JSON.parse(bodyStr || '{}');
                const rawPayload = parsed.base64Data || parsed.image || parsed.b64 || parsed.data || parsed.fileData || '';
                const mimeType = parsed.mimeType || 'image/jpeg';
                const fileName = parsed.fileName || 'receipt.jpg';

                const { extractReceiptFromImage } = await getGeminiExtractor();
                const result = await extractReceiptFromImage(
                  rawPayload,
                  mimeType,
                  fileName
                );
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: true,
                    result,
                    data: result.data,
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
                  })
                );
              } catch (err: any) {
                console.error('Vite API extraction error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: false,
                    error: err?.message || 'Extraction failed',
                    error_stage: err?.stage || 'extraction',
                    error_message: err?.message || 'Extraction failed',
                  })
                );
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e?.message }));
          }
          return;
        }

        if (req.url?.startsWith('/api/test-minimal-extraction') && req.method === 'POST') {
          try {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            });
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                const parsed = JSON.parse(bodyStr || '{}');
                const rawPayload = parsed.base64Data || parsed.image || parsed.b64 || parsed.data || parsed.fileData || '';
                const mimeType = parsed.mimeType || 'image/jpeg';
                const fileName = parsed.fileName || 'receipt.jpg';

                const { testMinimalExtraction } = await getGeminiExtractor();
                const result = await testMinimalExtraction(
                  rawPayload,
                  mimeType,
                  fileName
                );
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: true,
                    rawResponse: result.rawResponseText,
                    parsed: result.parsed,
                    diagnostic: result.diagnostic,
                  })
                );
              } catch (err: any) {
                console.error('Vite API minimal test error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: false,
                    error: err?.message || 'Minimal test failed',
                    error_stage: err?.stage || 'minimal_test',
                    error_message: err?.message || 'Minimal test failed',
                  })
                );
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e?.message }));
          }
          return;
        }

        if (req.url === '/api/model-config' && req.method === 'GET') {
          try {
            const { getModelRouterConfig } = await getModelRouter();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, config: getModelRouterConfig() }));
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e?.message }));
          }
          return;
        }

        if (req.url === '/api/model-config' && req.method === 'POST') {
          try {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            });
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                const parsed = JSON.parse(bodyStr || '{}');
                const { updateModelRouterConfig, resetModelRouterConfig, getModelRouterConfig } = await getModelRouter();
                if (parsed.reset) {
                  const config = resetModelRouterConfig();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, message: 'Model router reset', config }));
                  return;
                }
                const updated = updateModelRouterConfig({
                  ...(parsed.primaryModel ? { primaryModel: String(parsed.primaryModel) } : {}),
                  ...(parsed.escalationModel ? { escalationModel: String(parsed.escalationModel) } : {}),
                  ...(Array.isArray(parsed.fallbackCandidates) ? { fallbackCandidates: parsed.fallbackCandidates } : {}),
                });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Model router updated', config: updated }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err?.message }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e?.message }));
          }
          return;
        }

        if (req.url?.startsWith('/api/extract-statement') && req.method === 'POST') {
          try {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            });
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                const parsed = JSON.parse(bodyStr || '{}');
                const { extractStatementFromPdfOrImage } = await getStatementExtractor();
                const result = await extractStatementFromPdfOrImage(
                  parsed.base64Data || parsed.image || '',
                  parsed.mimeType || 'image/jpeg',
                  parsed.fileName || 'statement.pdf',
                  parsed.userEmail || '',
                  parsed.fileId || `stmt-${Date.now()}`
                );
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, ...result }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err?.message || 'Statement extraction failed' }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e?.message }));
          }
          return;
        }

        if (req.url === '/api/health') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
