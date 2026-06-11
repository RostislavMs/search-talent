/**
 * One-off: apply a CORS policy to the R2 bucket so the browser can PUT
 * directly to presigned upload URLs. Reads R2_* from .env.local.
 *
 * Run: node --env-file=.env.local scripts/apply-r2-cors.mjs
 */
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("Missing R2_* env vars");
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const AllowedOrigins = [
  "https://searchtalent.dev",
  "https://www.searchtalent.dev",
  "http://localhost:3000",
];

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins,
          AllowedMethods: ["PUT", "GET", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log("Applied CORS to bucket:", bucket);
console.log(JSON.stringify(current.CORSRules, null, 2));
