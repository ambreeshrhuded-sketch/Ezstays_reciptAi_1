import 'dotenv/config';
import { extractReceiptFromImage } from '../src/server/geminiExtractor';
import { getModelRouterConfig } from '../src/server/modelRouter';

// Simple 1x1 base64 PNG receipt sample for end-to-end API roundtrip verification
const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function main() {
  console.log('--- Initializing Model Routing Layer ---');
  const config = getModelRouterConfig();
  console.log('Model Router Configuration:');
  console.log(`  - Primary Model: ${config.primaryModel}`);
  console.log(`  - Escalation Model: ${config.escalationModel}`);
  console.log(`  - Fallback Sequence: ${config.fallbackCandidates.join(' -> ')}`);
  console.log(`  - Max Retries / Model: ${config.maxRetriesPerModel}\n`);

  console.log('--- Submitting Sample Receipt to Model Router Layer ---');
  const startTime = Date.now();
  try {
    const result = await extractReceiptFromImage(sampleBase64, 'image/png', 'sample_receipt_test.png');
    const elapsed = Date.now() - startTime;

    console.log('\n================ EXTRACTION SUCCESS ================');
    console.log(`Actual Model Used: ${result.debugInfo?.modelUsed || 'N/A'}`);
    console.log(`Is Escalated: ${result.debugInfo?.isEscalated ? 'YES' : 'NO'}`);
    console.log(`Execution Time: ${elapsed}ms`);
    console.log('\n--- Model Routing Log ---');
    (result.debugInfo?.routingLog || []).forEach((log) => console.log(`  * ${log}`));

    console.log('\n--- API Extracted Data Output ---');
    console.log(JSON.stringify(result.data, null, 2));

    console.log('\n--- Debug Info ---');
    console.log(JSON.stringify(result.debugInfo, null, 2));
    console.log('====================================================');
  } catch (err: any) {
    console.error('\n❌ Extraction error encountered:', err.message);
    if (err.stage) console.error(`Stage: ${err.stage}`);
    process.exit(1);
  }
}

main();
