import "server-only";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

let cachedClient: S3Client | null = null;

function getClient() {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
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
