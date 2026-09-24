import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 fala a API do S3 — mesmo SDK, só trocando o endpoint pro da conta
// Cloudflare. Diferente do Blob da Vercel, o bucket fica privado por
// padrão: só quem tem essas credenciais (ou uma URL pré-assinada de prazo
// curto) lê ou escreve nele.
function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Armazenamento R2 não configurado (variáveis de ambiente faltando).");
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const { accountId, accessKeyId, secretAccessKey } = r2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

/**
 * URL pré-assinada de upload direto do navegador (PUT), válida por 10
 * minutos. `contentType`/`contentLength` entram na assinatura — o PUT só é
 * aceito se o navegador mandar exatamente esses valores, o que ele faz
 * naturalmente (Content-Length é calculado do corpo real da requisição).
 */
export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const { bucket } = r2Config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 600 });
}

/** Lê um objeto do R2, com suporte a `Range` pra busca/avanço de vídeo. Retorna `null` se não existir. */
export async function getObject(input: {
  key: string;
  range?: string;
}): Promise<GetObjectCommandOutput | null> {
  const { bucket } = r2Config();
  try {
    return await getClient().send(
      new GetObjectCommand({ Bucket: bucket, Key: input.key, Range: input.range }),
    );
  } catch (error) {
    if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
      return null;
    }
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { bucket } = r2Config();
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Sobe um objeto direto do servidor (usado só pela migração histórica do Vercel Blob). */
export async function putObject(input: {
  key: string;
  body: ReadableStream | Uint8Array;
  contentType: string | null;
  contentLength: number;
}): Promise<void> {
  const { bucket } = r2Config();
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType ?? undefined,
      ContentLength: input.contentLength,
    }),
  );
}
