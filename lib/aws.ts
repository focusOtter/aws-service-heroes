import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types'

export const AWS_REGION = process.env.AWS_REGION ?? 'us-west-2'

/**
 * Credential selection:
 * - On Vercel (production), AWS_ROLE_ARN is set and we federate via OIDC —
 *   no static keys ever live in the host.
 * - Locally, AWS_ROLE_ARN is unset, so we return `undefined` and let the SDK
 *   fall back to its default credential chain (which honors AWS_PROFILE / SSO).
 */
export function awsCredentials(): AwsCredentialIdentityProvider | undefined {
  if (process.env.AWS_ROLE_ARN) {
    return awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN })
  }
  return undefined
}
