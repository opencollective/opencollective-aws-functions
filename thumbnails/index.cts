import { S3Client, GetObjectCommand, PutObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { APIGatewayEvent, S3Event } from 'aws-lambda';
import { generatePdfThumbnail, generateThumbnail } from './generate.cjs';

const s3 =
  process.env.AWS_KEY || process.env.AWS_SECRET
    ? new S3Client({
        forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
        endpoint: process.env.AWS_S3_ENDPOINT,
        tls: process.env.AWS_S3_SSL_ENABLED === 'true',
        apiVersion: process.env.AWS_S3_API_VERSION,
        region: process.env.AWS_S3_REGION,
        credentials: {
          accessKeyId: process.env.AWS_KEY || '',
          secretAccessKey: process.env.AWS_SECRET || '',
        },
      })
    : new S3Client();

function isImageMimeType(it: string) {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(it);
}

function shouldGenerateThumbnailForObject(object: S3Event['Records'][number]['s3']['object']): boolean {
  const userMetadata = 'userMetadata' in object ? (object.userMetadata as Record<string, string>) : {};
  const key = decodeURIComponent(object.key.replace(/\+/g, '%20'));

  if (
    key.endsWith('.thumbnail') ||
    userMetadata['X-Amz-Meta-X-Oc-Is-Thumbnail'] === 'true' ||
    !['expense-invoice', 'expense-item', 'expense-attached-file'].some(kind => key.includes(kind))
  ) {
    return true;
  }

  return true;
}

export async function handler(event: S3Event) {
  const bucket = event.Records[0].s3.bucket.name;
  const object = event.Records[0].s3.object;
  const key = decodeURIComponent(object.key.replace(/\+/g, '%20'));
  console.log(event);

  if (!event.Records[0].eventName.includes('ObjectCreated:') || !shouldGenerateThumbnailForObject(object)) {
    return;
  }

  let s3GetObjectOutput: GetObjectCommandOutput;
  try {
    s3GetObjectOutput = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.error(err);
    return;
  }

  console.log('got new s3 object');

  const isSupportedMimeType =
    isImageMimeType(s3GetObjectOutput.ContentType as string) || s3GetObjectOutput.ContentType === 'application/pdf';

  if (s3GetObjectOutput.Metadata?.['x-oc-is-thumbnail'] === 'true') {
    return;
  }

  if (!isSupportedMimeType) {
    console.error(`Unsupported mime type ${s3GetObjectOutput.ContentType}`);
    return;
  }

  const fileBuffer = await s3GetObjectOutput.Body?.transformToByteArray();
  if (!fileBuffer) {
    console.error(`could not get file buffer for ${bucket}/${key}`);
    return;
  }

  const generator = isImageMimeType(s3GetObjectOutput.ContentType as string) ? generateThumbnail : generatePdfThumbnail;

  try {
    console.log('generating thumbnail');
    const thumbnail = await generator(fileBuffer);
    console.log('generated thumbnail');
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${key}.thumbnail`,
        Body: thumbnail,
        ContentLength: thumbnail.byteLength,
        ContentType: 'image/png',
        Metadata: {
          'x-oc-is-thumbnail': 'true',
        },
      }),
    );
    console.log('uploaded thumbnail');
  } catch (err) {
    console.error(err);
    return;
  }
}

export async function minioHandler(event: APIGatewayEvent) {
  if (event.requestContext.httpMethod === 'HEAD') {
    return {
      statusCode: 200,
    };
  }

  await handler(JSON.parse(event.body as string));
  return {
    statusCode: 200,
  };
}
