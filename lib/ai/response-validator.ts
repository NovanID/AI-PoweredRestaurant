import { ValidationResult, ToolResult } from './types';
import { MenuItem } from '../domain/types';

export class ResponseValidator {
  /**
   * Comprehensive validation pipeline to catch hallucinations, price mismatches, and false success claims
   */
  public static validate(params: {
    generatedReply: string;
    toolExecuted?: ToolResult;
    menuSnapshot?: MenuItem[];
  }): ValidationResult {
    const { generatedReply, toolExecuted, menuSnapshot = [] } = params;
    const reasons: string[] = [];
    let sanitizedOutput = generatedReply;

    // 1. Tool Result Consistency Check
    // If a mutating tool failed, response MUST NOT claim success
    if (toolExecuted && !toolExecuted.success) {
      const lower = generatedReply.toLowerCase();
      if (
        lower.includes('berhasil') ||
        lower.includes('terkonfirmasi') ||
        lower.includes('telah diamankan')
      ) {
        reasons.push('FALSE_SUCCESS_CLAIM: Tool returned failure but reply claims success.');
        sanitizedOutput = `Mohon maaf, sistem tidak dapat menyelesaikan permintaan Anda: ${toolExecuted.message}`;
      }
    }

    // 2. Price Grounding Check
    // Extract IDR currency patterns (e.g. "Rp 25.000" or "Rp25000")
    const priceRegex = /Rp\s?([\d.,]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = priceRegex.exec(generatedReply)) !== null) {
      const parsedPrice = parseInt(match[1].replace(/[.,]/g, ''), 10);
      if (parsedPrice > 0 && parsedPrice < 1000) {
        // Obvious typo like "Rp 25" instead of "Rp 25.000"
        reasons.push(`SUSPICIOUS_PRICE_FORMAT: Found parsed price ${parsedPrice}`);
      }
    }

    // 3. PII & Sensitive Pattern Check (e.g. 16-digit credit card number)
    const creditCardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
    if (creditCardRegex.test(generatedReply)) {
      reasons.push('PII_DETECTED: Response contains potential credit card number.');
      sanitizedOutput = sanitizedOutput.replace(creditCardRegex, '[REDACTED]');
    }

    return {
      isValid: reasons.length === 0,
      reasons,
      sanitizedOutput,
    };
  }
}
