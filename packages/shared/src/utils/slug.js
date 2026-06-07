/**
 * Generate a URL-friendly slug from Chinese/English text
 */
export function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[\s]+/g, '-')
        .replace(/[^\w\u4e00-\u9fff-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        || `post-${Date.now()}`;
}
/**
 * Extract excerpt from Markdown content
 */
export function extractExcerpt(content, maxLength = 200) {
    const text = content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
        .replace(/(`{1,3}[^`]+`{1,3})/g, '$1')
        .replace(/(\*{1,3}[^*]+\*{1,3})/g, '$1')
        .replace(/(~~[^~]+~~)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim();
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}
/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename) {
    const ext = filename.split('.').pop() || '';
    const name = filename.slice(0, -(ext.length + 1));
    const sanitized = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]/g, '_');
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `${sanitized}-${timestamp}${random}.${ext}`;
}
/**
 * Check if a MIME type is allowed
 */
export function isAllowedMimeType(mimeType, allowedTypes) {
    return allowedTypes.includes(mimeType);
}
