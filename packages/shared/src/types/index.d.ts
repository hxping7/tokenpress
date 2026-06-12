export interface User {
    id: number;
    username: string;
    displayName: string | null;
    role: UserRole;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export type UserRole = 'superadmin' | 'admin' | 'user';
export interface CreateUserDTO {
    username: string;
    password: string;
    displayName?: string;
    role?: UserRole;
}
export interface LoginDTO {
    username: string;
    password: string;
}
export interface JwtPayload {
    userId: number;
    username: string;
    role: UserRole;
}
export interface AuthResponse {
    token: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
}
export interface ApiToken {
    id: number;
    userId: number;
    token: string;
    name: string;
    permissions: ApiPermission[];
    lastUsedAt: string | null;
    expiresAt: string | null;
    isActive: boolean;
    createdAt: string;
}
export type ApiPermission = 'article:write' | 'media:upload' | 'work:write' | 'content:delete' | 'settings:write';
export interface CreateApiTokenDTO {
    name: string;
    permissions: ApiPermission[];
    expiresAt?: string | null;
}
export interface Category {
    id: number;
    name: string;
    slug: string;
    section: ContentSection;
    description: string | null;
    sortOrder: number;
}
export type ContentSection = 'token_plan' | 'ai_coding' | 'ai_works' | 'blog' | 'claw';
export type ContentStatus = 'draft' | 'published' | 'archived' | 'scheduled' | 'pending_review';
export interface Article {
    id: number;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    coverImage: string | null;
    section: ContentSection;
    categoryId: number | null;
    status: ContentStatus;
    authorId: number;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    author?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
    category?: Category | null;
    tags?: Tag[];
}
export interface CreateArticleDTO {
    title: string;
    content: string;
    section: ContentSection;
    categoryId?: number;
    tags?: string[];
    coverImage?: string;
    status?: ContentStatus;
    publishedAt?: string | null;
}
export interface UpdateArticleDTO extends Partial<CreateArticleDTO> {
}
export interface Tag {
    id: number;
    name: string;
}
export interface Media {
    id: number;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnailUrl: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    uploadedBy: number;
    createdAt: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface AIPublishDTO {
    title: string;
    content: string;
    section: ContentSection;
    category?: string;
    tags?: string[];
    coverImageUrl?: string;
    status?: ContentStatus;
    publishedAt?: string | null;
}
export interface AIPublishResponse {
    id: number;
    slug: string;
    url: string;
    status: ContentStatus;
}
export interface AIMediaUploadDTO {
    section?: string;
    associateId?: number;
}
