import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
// Files in messages: a bucket nobody can read without a signed link.
const privateBucketName = process.env.R2_PRIVATE_BUCKET_NAME;

let cachedClient: S3Client | null = null;

function getClient() {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // AWS SDK v3.730+ adds x-amz-checksum-* headers to PUTs by default.
      // Browsers can't compute/send those headers, so presigned uploads
      // would fail with SignatureDoesNotMatch. R2 doesn't require these
      // checksums, so we opt out of the default behaviour.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return cachedClient;
}

export function isR2Configured() {
  return Boolean(
    accountId && accessKeyId && secretAccessKey && bucketName && publicBaseUrl,
  );
}

export function getR2BucketName() {
  return bucketName ?? null;
}

export function getR2PublicUrl(key: string) {
  if (!publicBaseUrl) {
    return null;
  }

  return `${publicBaseUrl.replace(/\/+$/, "")}/${encodeKey(key)}`;
}

// Encode each path segment so '/' separators stay readable but spaces /
// reserved characters in file names are escaped. Mirrors how Supabase
// `getPublicUrl` produced URLs so existing client code (Image / fetch)
// keeps working unchanged.
function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

type PresignOptions = {
  key: string;
  contentType: string;
  contentLength?: number;
  expiresIn?: number;
};

export async function createPresignedUploadUrl({
  key,
  contentType,
  contentLength,
  expiresIn = 300,
}: PresignOptions) {
  const client = getClient();

  if (!client || !bucketName) {
    throw new Error("R2 storage is not configured");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return uploadUrl;
}

export async function deleteFromR2(key: string) {
  const client = getClient();

  if (!client || !bucketName) {
    throw new Error("R2 storage is not configured");
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

// Cache the public base hostname once so per-call parsing stays cheap.
const publicBaseHostname = (() => {
  if (!publicBaseUrl) return null;
  try {
    return new URL(publicBaseUrl).hostname;
  } catch {
    return null;
  }
})();

export function isR2Url(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  // Parse the URL so we match on hostname, not raw substring. A plain
  // `string.includes(".r2.dev")` would also match malicious URLs like
  // `https://evil.com/path?x=.r2.dev`, which is what CodeQL flagged.
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }

  if (publicBaseHostname && host === publicBaseHostname) {
    return true;
  }

  return (
    host === "r2.cloudflarestorage.com" ||
    host.endsWith(".r2.cloudflarestorage.com") ||
    host === "r2.dev" ||
    host.endsWith(".r2.dev")
  );
}

// --- The private bucket (files in messages) ----------------------------------------

export function isPrivateStorageConfigured() {
  return Boolean(accountId && accessKeyId && secretAccessKey && privateBucketName);
}

function getPrivateBucket() {
  const client = getClient();

  if (!client || !privateBucketName) {
    throw new Error("Private R2 storage is not configured");
  }

  return { client, bucket: privateBucketName };
}

/** A signed PUT into the private bucket: this key, this type, exactly this size. */
export async function createPrivateUploadUrl({
  key,
  contentType,
  contentLength,
  expiresIn = 300,
}: PresignOptions & { contentLength: number }) {
  const { client, bucket } = getPrivateBucket();

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn },
  );
}

/**
 * A short-lived signed GET for one private object. The response type is the
 * one the database holds (checked at upload), never what the uploader sent,
 * and the file name comes back in Content-Disposition.
 */
export async function createPrivateDownloadUrl({
  key,
  contentType,
  contentDisposition,
  expiresIn = 300,
}: {
  key: string;
  contentType: string;
  contentDisposition: string;
  expiresIn?: number;
}) {
  const { client, bucket } = getPrivateBucket();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: contentDisposition,
      ResponseCacheControl: "private, max-age=3600",
    }),
    { expiresIn },
  );
}

/** How many first bytes of an upload are read back to tell its type. */
export const PRIVATE_OBJECT_HEAD_BYTES = 16;

/**
 * What an uploaded private object really is: its size and its first bytes.
 * Null when there is no such object (the upload never arrived).
 */
export async function inspectPrivateObject(key: string): Promise<{ size: number; head: Uint8Array } | null> {
  const { client, bucket } = getPrivateBucket();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: `bytes=0-${PRIVATE_OBJECT_HEAD_BYTES - 1}`,
      }),
    );
    // "bytes 0-15/2048": the total after the slash.
    const total = Number(/\/(\d+)$/.exec(response.ContentRange ?? "")?.[1] ?? response.ContentLength ?? 0);
    const head = response.Body ? await response.Body.transformToByteArray() : new Uint8Array();
    return { size: total, head };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "NoSuchKey" || name === "NotFound") {
      return null;
    }
    throw error;
  }
}

export async function deleteFromPrivateR2(key: string) {
  const { client, bucket } = getPrivateBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * The object key behind one of our public R2 URLs (`<base>/<key>`), or null
 * for any other URL. A `?v=` cache buster is not part of the key.
 */
export function getR2KeyFromUrl(url: string): string | null {
  if (!isR2Url(url)) {
    return null;
  }

  try {
    let path = new URL(url).pathname;
    const basePath = publicBaseUrl
      ? new URL(publicBaseUrl).pathname.replace(/\/+$/, "")
      : "";
    if (basePath && path.startsWith(`${basePath}/`)) {
      path = path.slice(basePath.length);
    }
    const key = path
      .replace(/^\/+/, "")
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return key || null;
  } catch {
    return null;
  }
}
