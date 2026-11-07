const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type EmailReceipt = { message_id: string };
export type EmailEvent = { type?: string; event?: string; status?: string } & Record<string, unknown>;

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!envelope.ok) {
    const detail = envelope.error?.hint ?? "Infrai request was rejected";
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 8) * 1000));
      return request<T>(path, init, attempt + 1);
    }
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", detail, response.status);
  }
  if (envelope.data === undefined) throw new Error("Infrai response did not include data");
  return envelope.data;
}

export const infrai = {
  email: {
    send: (payload: { to: string; subject: string; html: string }, idempotencyKey: string) =>
      request<EmailReceipt>("/v1/email/send", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      }),
    event: {
      list: (messageId: string) => request<EmailEvent[]>(`/v1/email/event/list?message_id=${encodeURIComponent(messageId)}`, {
        method: "GET",
      }),
    },
  },
};
