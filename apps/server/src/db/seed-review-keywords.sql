-- Seed sensitive keywords for content review system
-- These are basic Chinese sensitive words for initial deployment
-- Admin should add more keywords via the admin panel

-- Gambling (block)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('赌博', 'gambling', 'high', 'block', 'all'),
  ('博彩', 'gambling', 'high', 'block', 'all'),
  ('赌场', 'gambling', 'high', 'block', 'all'),
  ('下注', 'gambling', 'medium', 'block', 'all'),
  ('投注', 'gambling', 'medium', 'block', 'all'),
  ('百家乐', 'gambling', 'high', 'block', 'all'),
  ('老虎机', 'gambling', 'high', 'block', 'all');

-- Pornography (block)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('色情', 'pornography', 'high', 'block', 'all'),
  ('裸聊', 'pornography', 'high', 'block', 'all'),
  ('成人视频', 'pornography', 'high', 'block', 'all');

-- Fraud/Scam (block)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('刷单', 'fraud', 'high', 'block', 'all'),
  ('兼职刷单', 'fraud', 'high', 'block', 'all'),
  ('杀猪盘', 'fraud', 'high', 'block', 'all'),
  ('电信诈骗', 'fraud', 'high', 'block', 'all');

-- Financial risk (review)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('借贷', 'finance', 'medium', 'review', 'all'),
  ('网贷', 'finance', 'medium', 'review', 'all'),
  ('高利贷', 'finance', 'high', 'block', 'all'),
  ('信用卡套现', 'finance', 'high', 'block', 'all'),
  ('虚拟货币', 'finance', 'low', 'review', 'all'),
  ('ICO', 'finance', 'medium', 'review', 'all'),
  ('代币发行', 'finance', 'medium', 'review', 'all');

-- Drugs (block)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('毒品', 'drugs', 'high', 'block', 'all'),
  ('大麻', 'drugs', 'high', 'block', 'all'),
  ('冰毒', 'drugs', 'high', 'block', 'all');

-- Violence (block)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('杀人', 'violence', 'high', 'block', 'all'),
  ('自杀', 'violence', 'high', 'review', 'all'),
  ('爆炸', 'violence', 'high', 'block', 'all');

-- Contact info (review for ads)
INSERT OR IGNORE INTO sensitive_keywords (keyword, category, severity, action, scope) VALUES
  ('加微信', 'contact', 'low', 'review', 'ad'),
  ('加QQ', 'contact', 'low', 'review', 'ad'),
  ('扫码领', 'contact', 'low', 'review', 'ad');
