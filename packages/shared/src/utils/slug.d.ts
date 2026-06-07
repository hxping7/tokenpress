/**
 * Generate a URL-friendly slug from Chinese/English text
 */
export declare function generateSlug(text: string): string;
/**
 * Extract excerpt from Markdown content
 */
export declare function extractExcerpt(content: string, maxLength?: number): string;
/**
 * Format file size to human-readable string
 */
export declare function formatFileSize(bytes: number): string;
/**
 * Sanitize filename for storage
 */
export declare function sanitizeFilename(filename: string): string;
/**
 * Check if a MIME type is allowed
 */
export declare function isAllowedMimeType(mimeType: string, allowedTypes: readonly string[]): boolean;
