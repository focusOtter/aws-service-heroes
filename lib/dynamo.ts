import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { AWS_REGION, awsCredentials } from './aws'

const table = process.env.HEROES_TABLE_NAME!

const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: awsCredentials(),
})
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

export type HeroStatus =
  | 'image_ready'
  | 'video_pending'
  | 'complete'
  | 'video_failed'

export type HeroRecord = {
  id: string
  entity: 'hero' // constant partition key for the gallery GSI
  createdAt: string
  status: HeroStatus
  heroName: string
  serviceId: string
  serviceName: string
  presetId: string
  imageKey: string
  /** The attendee's original (downscaled) selfie — shown in the gallery lightbox. */
  originalKey?: string
  videoKey?: string
  githubLogin?: string
  linkedinUrl?: string
  issueNumber?: number
  issueUrl?: string
  userSub?: string
  /** Stored so the completion Lambda can re-exchange it with no session. */
  refreshToken?: string
  invocationArn?: string
}

export async function putHero(record: HeroRecord): Promise<void> {
  await ddb.send(new PutCommand({ TableName: table, Item: record }))
}

export async function getHero(id: string): Promise<HeroRecord | undefined> {
  const res = await ddb.send(new GetCommand({ TableName: table, Key: { id } }))
  return res.Item as HeroRecord | undefined
}

export async function patchHero(
  id: string,
  patch: Partial<HeroRecord>,
): Promise<void> {
  const keys = Object.keys(patch)
  if (keys.length === 0) return

  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
  const sets = keys.map((k, i) => {
    names[`#k${i}`] = k
    values[`:v${i}`] = patch[k as keyof HeroRecord]
    return `#k${i} = :v${i}`
  })

  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { id },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  )
}

/** Newest-first gallery read via the constant-PK GSI (no scan). */
export async function listHeroes(limit = 60): Promise<HeroRecord[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table,
      IndexName: 'byCreatedAt',
      KeyConditionExpression: 'entity = :e',
      ExpressionAttributeValues: { ':e': 'hero' },
      ScanIndexForward: false,
      Limit: limit,
    }),
  )
  return (res.Items as HeroRecord[]) ?? []
}
