import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3-pro-image'
// Optional cheaper/lighter model to fall back to when the primary is
// temporarily overloaded (Gemini returns 503 UNAVAILABLE under demand spikes).
// "Nano Banana" = gemini-2.5-flash-image. Leave unset to disable the fallback.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL

export type ImageInput = { data: Uint8Array; mediaType: string }
export type GeneratedImage = { data: Uint8Array; mediaType: string }

async function runModel(
  modelId: string,
  prompt: string,
  selfie: ImageInput,
): Promise<GeneratedImage> {
  const result = await generateText({
    model: google(modelId),
    // The default is 2; bump it so a transient 503 demand-spike rides through
    // the SDK's exponential backoff instead of failing the submission.
    maxRetries: 4,
    providerOptions: {
      google: { responseModalities: ['TEXT', 'IMAGE'] },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: selfie.data, mediaType: selfie.mediaType },
        ],
      },
    ],
  })

  const image = result.files.find((f) => f.mediaType?.startsWith('image/'))
  if (!image) {
    throw new Error('Gemini returned no image for the hero composite')
  }
  return { data: image.uint8Array, mediaType: image.mediaType }
}

/**
 * Nano Banana (Gemini) identity-preserving composite. We feed the attendee's
 * selfie plus the text prompt (which carries the AWS service motif + style),
 * and read the generated image back out of `result.files`. Falls back to a
 * secondary model if the primary stays overloaded.
 */
export async function generateHeroImage(
  prompt: string,
  selfie: ImageInput,
): Promise<GeneratedImage> {
  try {
    return await runModel(MODEL, prompt, selfie)
  } catch (err) {
    if (FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
      console.warn(
        `[gemini] ${MODEL} failed, trying fallback ${FALLBACK_MODEL}:`,
        err instanceof Error ? err.message : err,
      )
      return await runModel(FALLBACK_MODEL, prompt, selfie)
    }
    throw err
  }
}
