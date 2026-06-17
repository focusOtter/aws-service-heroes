// The AWS services an attendee can become the superstar of, and the single
// style preset for the composite. Curated defaults — easy to extend.

export type AwsService = {
  id: string
  name: string
  /** Short visual cue handed to the image model so the icon/theme reads right. */
  motif: string
}

export const AWS_SERVICES: AwsService[] = [
  { id: 'lambda', name: 'AWS Lambda', motif: 'a glowing orange lambda (λ) symbol, serverless energy' },
  { id: 's3', name: 'Amazon S3', motif: 'green storage buckets overflowing with data orbs' },
  { id: 'dynamodb', name: 'Amazon DynamoDB', motif: 'a blue crystalline database with lightning-fast streaks' },
  { id: 'ec2', name: 'Amazon EC2', motif: 'orange server towers and floating compute instances' },
  { id: 'bedrock', name: 'Amazon Bedrock', motif: 'a teal neural-network aura and generative-AI sparks' },
  { id: 'cloudfront', name: 'Amazon CloudFront', motif: 'a purple global edge network with light beams across a globe' },
  { id: 'sqs', name: 'Amazon SQS', motif: 'pink message queues flowing in an orderly stream' },
  { id: 'appsync', name: 'AWS AppSync', motif: 'magenta realtime data ripples and GraphQL constellations' },
  { id: 'stepfunctions', name: 'AWS Step Functions', motif: 'pink interconnected state-machine pathways' },
  { id: 'aurora', name: 'Amazon Aurora', motif: 'a blue luminous relational database core' },
  { id: 'amplify', name: 'AWS Amplify', motif: 'a vibrant orange waveform and full-stack build glyphs swirling around them' },
  { id: 'eventbridge', name: 'Amazon EventBridge', motif: 'pink event buses radiating outward with crisscrossing event arrows' },
  { id: 'apigateway', name: 'Amazon API Gateway', motif: 'a purple archway of API endpoints with request/response light streams' },
  { id: 'fargate', name: 'AWS Fargate', motif: 'orange floating serverless containers with thrusters of compute' },
  { id: 'sagemaker', name: 'Amazon SageMaker', motif: 'a green ML model orb with neural-net constellations and training graphs' },
  { id: 'rds', name: 'Amazon RDS', motif: 'a deep-blue managed database citadel with replicated data crystals' },
  { id: 'cognito', name: 'Amazon Cognito', motif: 'a red identity sigil with auth-token sparks and user-pool runes' },
  { id: 'sns', name: 'Amazon SNS', motif: 'red broadcast pulses fanning out to many subscribers' },
]

export type StylePreset = {
  id: string
  name: string
  /** Appended to the prompt to set the overall art direction. */
  direction: string
}

// One style, one vibe: comic-book superhero. Keeping the array (and the
// findPreset helper) so the rest of the pipeline keeps working without churn.
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'superhero',
    name: 'Superhero',
    direction:
      'bold comic-book superhero illustration, dynamic ink lines, halftone shading, dramatic cape and pose, vibrant primary colors',
  },
]

export const DEFAULT_PRESET = STYLE_PRESETS[0]

export function findService(id: string): AwsService | undefined {
  return AWS_SERVICES.find((s) => s.id === id)
}

export function findPreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((p) => p.id === id)
}

/** Build the identity-preserving composite prompt for the image model. */
export function buildImagePrompt(
  service: AwsService,
  preset: StylePreset,
  heroName: string,
): string {
  return [
    `Create a heroic portrait of this exact person — preserve their face, identity, and likeness faithfully.`,
    `They are the superstar of ${service.name}, surrounded by ${service.motif}.`,
    `Art direction: ${preset.direction}.`,
    `Include the title "${heroName}, Superstar of ${service.name}" tastefully integrated into the scene.`,
    `Single subject, centered, portrait orientation, high detail.`,
  ].join(' ')
}

/** Build the motion prompt handed to Luma Ray 2 for the still → video step. */
export function buildVideoPrompt(service: AwsService, preset: StylePreset): string {
  return [
    `Subtle cinematic motion bringing the superstar to life:`,
    `gentle camera push-in, ${service.motif} drifting and glowing,`,
    `${preset.direction}, hair and cape moving slightly, ambient particles.`,
    `Keep the subject's face stable and recognizable.`,
  ].join(' ')
}
