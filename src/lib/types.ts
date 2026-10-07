// Server ilə müştəri arasında ötürülən DTO-lar. Tarixlər ISO sətir kimi gəlir.
import type { CategoryKey } from "@/lib/categories";

export type ReportStatus = "active" | "verified" | "outdated" | "hidden" | "deleted";
export type VoteKind = "confirm" | "outdated";
export type FeedSort = "new" | "near" | "top";

export type LatLng = { lat: number; lng: number };

/** Xəritə pini üçün yüngül obyekt */
export type MapReport = {
  id: string;
  category: CategoryKey;
  status: ReportStatus;
  lat: number;
  lng: number;
  title: string;
  createdAt: string;
};

/** Lent kartı / yaxınlıqdakılar siyahısı */
export type ReportCard = MapReport & {
  note: string;
  address: string | null;
  locality: string | null;
  distanceM: number | null;
  confirmCount: number;
  outdatedCount: number;
  thumbUrl: string | null;
  mediaCount: number;
  hasVideo: boolean;
};

export type MediaItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
};

export type ReportDetail = ReportCard & {
  media: MediaItem[];
  myVote: VoteKind | null;
  myFlagged: boolean;
  isOwn: boolean;
};

export type FeedPage = { items: ReportCard[]; nextCursor: string | null };

export type NearbySummary = {
  items: ReportCard[];
  /** Son 24 saatda radius daxilində yeni bildirişlər */
  newCount: number;
  radiusM: number;
};

export type AlertZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  categories: CategoryKey[];
  enabled: boolean;
};

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  /** Hər bildiriş üçün ayrıca təxəllüs, məs. "A3F9" → "Sürücü A3F9" */
  nickname: string;
  /** Rəyi bildirişin müəllifi yazıb */
  isAuthor: boolean;
  isMine: boolean;
  myFlagged: boolean;
};

export type CommentPage = { items: CommentItem[]; total: number; nextCursor: string | null };

/** API xəta kodları → istifadəçiyə göstərilən mətn */
export const API_ERRORS: Record<string, string> = {
  rate_limited: "Saatda maksimum bildiriş sayına çatdınız. Bir az sonra yenidən cəhd edin.",
  device_blocked: "Bu cihazdan bildiriş göndərmək məhdudlaşdırılıb.",
  own_report: "Öz bildirişinizə səs verə bilməzsiniz.",
  already_voted: "Bu bildirişə artıq səs vermisiniz.",
  already_flagged: "Bu bildirişdən artıq şikayət etmisiniz.",
  not_found: "Bildiriş tapılmadı və ya silinib.",
  bad_request: "Məlumatlar düzgün deyil.",
  media_required: "Ən azı bir şəkil və ya video əlavə edin.",
  media_invalid: "Fayl oxunmadı. Başqa şəkil və ya video seçin.",
  video_too_long: "Video 30 saniyədən uzun olmamalıdır.",
  video_too_large: "Video 50 MB-dan böyük olmamalıdır.",
  video_unsupported: "Video emalı hazırda mümkün deyil. Şəkil əlavə edin.",
  too_many_files: "Ən çox 4 fayl əlavə etmək olar.",
  push_not_configured: "Push bildirişləri serverdə konfiqurasiya olunmayıb.",
  comment_rate_limited: "Saatda maksimum rəy sayına çatdınız. Bir az sonra yenidən yazın.",
  comment_too_fast: "Rəylər arasında bir neçə saniyə gözləyin.",
  own_comment: "Öz rəyinizdən şikayət edə bilməzsiniz.",
};
