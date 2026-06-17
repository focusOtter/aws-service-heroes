import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { AWS_REGION, awsCredentials } from './aws'

const bucket = process.env.ASSETS_BUCKET_NAME!
const cdnDomain = process.env.ASSETS_CDN_DOMAIN!

export const s3 = new S3Client({
  region: AWS_REGION,
  credentials: awsCredentials(),
})

/** Upload bytes and return the S3 key. */
export async function uploadAsset(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  return key
}

/** Public CloudFront URL for a stored asset (cached at the edge for booth wifi). */
export function cdnUrl(key: string): string {
  return `https://${cdnDomain}/${key}`
}

/** Read an object's bytes back out of the bucket (e.g. the Luma mp4 output). */
export async function getAssetBytes(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return res.Body!.transformToByteArray()
}

export const ASSETS_BUCKET = bucket
