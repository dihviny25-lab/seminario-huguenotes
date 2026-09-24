export type UploadPurpose = "assignment" | "material" | "library" | "video" | "slide";

const MB = 1024 * 1024;
const GB = 1024 * MB;

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const PRESENTATION_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export type UploadPolicy = {
  requiresTeacher: boolean;
  allowedContentTypes: string[];
  maximumSizeInBytes: number;
};

export function getUploadPolicy(purpose: UploadPurpose): UploadPolicy {
  switch (purpose) {
    case "assignment":
      return {
        requiresTeacher: false,
        allowedContentTypes: [...DOCUMENT_TYPES, ...PRESENTATION_TYPES, "image/png", "image/jpeg"],
        maximumSizeInBytes: 50 * MB,
      };
    case "material":
      return {
        requiresTeacher: true,
        allowedContentTypes: [...DOCUMENT_TYPES, ...PRESENTATION_TYPES, "image/png", "image/jpeg"],
        maximumSizeInBytes: 100 * MB,
      };
    case "library":
      return {
        requiresTeacher: true,
        allowedContentTypes: ["application/pdf", ...PRESENTATION_TYPES],
        maximumSizeInBytes: 250 * MB,
      };
    case "video":
      return {
        requiresTeacher: true,
        allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
        maximumSizeInBytes: 2 * GB,
      };
    case "slide":
      return {
        requiresTeacher: true,
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: 100 * MB,
      };
  }
}
