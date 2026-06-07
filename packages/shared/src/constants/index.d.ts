export declare const DEFAULT_API_BASE_URL = "http://localhost:4000/api/v1";
export declare const CONTENT_SECTIONS: readonly [{
    readonly value: "token_plan";
    readonly label: "Token 计划";
}, {
    readonly value: "ai_coding";
    readonly label: "AI 编程";
}, {
    readonly value: "ai_works";
    readonly label: "AI 作品";
}, {
    readonly value: "blog";
    readonly label: "博客";
}];
export declare const USER_ROLES: readonly [{
    readonly value: "admin";
    readonly label: "管理员";
}, {
    readonly value: "editor";
    readonly label: "编辑";
}, {
    readonly value: "user";
    readonly label: "用户";
}];
export declare const CONTENT_STATUS: readonly [{
    readonly value: "draft";
    readonly label: "草稿";
}, {
    readonly value: "published";
    readonly label: "已发布";
}, {
    readonly value: "archived";
    readonly label: "已归档";
}];
export declare const API_PERMISSIONS: readonly [{
    readonly value: "article:write";
    readonly label: "发布/编辑文章";
}, {
    readonly value: "media:upload";
    readonly label: "上传媒体文件";
}, {
    readonly value: "work:write";
    readonly label: "发布 AI 作品";
}, {
    readonly value: "content:delete";
    readonly label: "删除内容";
}];
export declare const UPLOAD_LIMITS: {
    readonly imageSize: number;
    readonly videoSize: number;
    readonly allowedImageTypes: readonly ["image/jpeg", "image/png", "image/webp", "image/gif"];
    readonly allowedVideoTypes: readonly ["video/mp4", "video/webm"];
};
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const JWT_EXPIRES_IN = "7d";
export declare const REFRESH_TOKEN_EXPIRES_IN = "30d";
export declare const API_TOKEN_PREFIX = "t00_sk_";
export declare const RATE_LIMIT_WINDOW = 60;
export declare const RATE_LIMIT_MAX = 100;
