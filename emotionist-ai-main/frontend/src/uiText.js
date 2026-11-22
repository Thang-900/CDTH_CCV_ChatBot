export const PERSONALITY_LABELS = {
  neurotic: "Dễ bất ổn",
  average: "Cân bằng",
  resilient: "Kiên cường",
};

export const LEVEL_LABELS = {
  "very high": "Rất cao",
  high: "Cao",
  moderate: "Trung bình",
  low: "Thấp",
  "very low": "Rất thấp",
};

export const EMOTION_LABELS = {
  Joy: "Vui vẻ",
  Hope: "Hy vọng",
  Satisfaction: "Hài lòng",
  Relief: "Nhẹ nhõm",
  HappyFor: "Vui cho người khác",
  Pride: "Tự hào",
  Admiration: "Ngưỡng mộ",
  Love: "Yêu mến",
  Gratification: "Thỏa mãn",
  Gratitude: "Biết ơn",
  Trust: "Tin tưởng",
  Surprise: "Ngạc nhiên",
  Anticipation: "Mong đợi",
  Distress: "Đau khổ",
  Fear: "Sợ hãi",
  FearsConfirmed: "Nỗi sợ thành sự thật",
  Disappointment: "Thất vọng",
  Pity: "Thương hại",
  Gloating: "Hả hê",
  Resentment: "Oán giận",
  Shame: "Xấu hổ",
  Reproach: "Trách móc",
  Hate: "Căm ghét",
  Remorse: "Hối hận",
  Anger: "Tức giận",
  Sadness: "Buồn bã",
  Disgust: "Ghê tởm",
  Envy: "Ghen tị",
  Guilt: "Tội lỗi",
  Contempt: "Khinh miệt",
};

export const PARAMETER_LABELS = {
  aggression: "Hung hăng",
  openness: "Cởi mở",
  creativity: "Sáng tạo",
  confidence: "Tự tin",
  cooperation: "Hợp tác",
};

export const EVENT_LABELS = {
  compliment: "Lời khen",
  achievement: "Thành tựu",
  good_news: "Tin vui",
  agreement: "Đồng tình",
  praise_of_other: "Khen người khác",
  insult: "Xúc phạm",
  threat: "Đe dọa",
  bad_news: "Tin xấu",
  failure: "Thất bại",
  disagreement: "Bất đồng",
  blame_of_other: "Đổ lỗi cho người khác",
  neutral: "Trung tính",
};

export const CATEGORY_LABELS = {
  customer_support: "Chăm sóc khách hàng",
  hr: "Nhân sự",
  onboarding: "Hướng dẫn hội nhập",
};

export const BACKEND_LABELS = {
  embeddings: "Tìm kiếm ngữ nghĩa",
  keyword: "Tìm kiếm từ khóa",
  none: "Chưa có",
};

export function displayLabel(labels, value) {
  return labels[value] || value;
}
