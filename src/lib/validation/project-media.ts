import { z } from "zod";

const mediaKindSchema = z.enum(["image", "video", "file"]);

const optionalString = (label: string, maxLength: number) =>
  z
    .any()
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    })
    .refine((value) => value === null || value.length <= maxLength, {
      message: `${label} is too long`,
    });

export const createProjectMediaSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  url: z.string().trim().url("Invalid media URL").max(2048, "Media URL is too long"),
  storagePath: optionalString("Storage path", 500),
  fileName: optionalString("File name", 255),
  mimeType: optionalString("Mime type", 255),
  fileSize: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null)),
  mediaKind: mediaKindSchema,
  sortIndex: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((value) =>
      typeof value === "number" && Number.isInteger(value) && value >= 0
        ? value
        : null,
    ),
});

export const updateProjectMediaSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  mediaId: z.string().uuid("Invalid media id"),
});

export const reorderProjectMediaSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  mediaIds: z
    .array(z.string().uuid("Invalid media id"))
    .min(1, "At least one media id is required")
    .max(50, "Too many media items"),
});
