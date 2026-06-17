import {
  BedrockRuntimeClient,
  StartAsyncInvokeCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { AWS_REGION, awsCredentials } from './aws'
import { ASSETS_BUCKET } from './s3'

const MODEL_ID = process.env.LUMA_MODEL_ID ?? 'luma.ray-v2:0'

const bedrock = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: awsCredentials(),
})

export type VideoInput = {
  prompt: string
  /** Starting keyframe (the finished hero still). */
  image: { data: Uint8Array; mediaType: string }
  /** Key prefix (within the assets bucket) for the model's output folder. */
  outputPrefix: string
}

/**
 * Kick off the Luma Ray 2 animation and return immediately with the
 * invocation ARN. We do NOT poll here — Bedrock writes the mp4 into the assets
 * bucket minutes later, and the S3 ObjectCreated event drives the completion
 * Lambda (which finalizes DynamoDB + patches the GitHub issue with no session).
 */
export async function startHeroVideo(input: VideoInput): Promise<string> {
  const base64 = Buffer.from(input.image.data).toString('base64')

  const start = await bedrock.send(
    new StartAsyncInvokeCommand({
      modelId: MODEL_ID,
      modelInput: {
        prompt: input.prompt,
        aspect_ratio: '9:16',
        loop: false,
        duration: '5s',
        resolution: '720p',
        keyframes: {
          frame0: {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.image.mediaType,
              data: base64,
            },
          },
        },
      },
      outputDataConfig: {
        s3OutputDataConfig: {
          s3Uri: `s3://${ASSETS_BUCKET}/${input.outputPrefix}`,
        },
      },
    }),
  )

  return start.invocationArn!
}
