/** Metadata for an email attachment */
export interface AttachmentMeta {
    id: string;
    name: string;
    type: string;
    size: number;
}

/** Summary of an email in the mailbox list */
export interface EmailSummary {
    id: string;
    from: string;
    subject: string;
    textPreview: string;
    receivedAt: Date;
    hasAttachments: boolean;
}

/** Full email details with attachments */
export interface EmailDetail {
    id: string;
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    receivedAt: Date;
    hasAttachments: boolean;
    attachments: AttachmentMeta[];
}

/** Paginated list of emails */
export interface PaginatedEmailList {
    data: EmailSummary[];
    nextCursor: string | null;
    total: number;
}

/** Options for generating a new email address */
export interface GenerateEmailOptions {
    domain?: string;
    prefix?: string;
}

/** Options for listing emails */
export interface ListEmailsOptions {
    limit?: number;
    cursor?: string;
}

/** Client configuration options */
export interface VanishClientOptions {
    apiKey?: string;
    timeout?: number;
}

/** Custom error class for API errors */
export class VanishError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = "VanishError";
    }
}

/**
 * Client for interacting with the Vanish Email API.
 *
 * @example
 * ```typescript
 * const client = new VanishClient("https://api.vanish.host", { apiKey: "your-key" });
 *
 * // Generate a temporary email
 * const email = await client.generateEmail();
 *
 * // List emails in the mailbox
 * const emails = await client.listEmails(email);
 *
 * // Get a specific email
 * const detail = await client.getEmail(emails.data[0].id);
 * ```
 */
export class VanishClient {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly timeout: number;

    constructor(baseUrl: string, options: VanishClientOptions = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.timeout = options.timeout ?? 30000;
    }

    private async request<T>(
        method: string,
        path: string,
        options: {
            params?: Record<string, string | number | undefined>;
            body?: unknown;
            rawResponse?: false;
        }
    ): Promise<T>;
    private async request(
        method: string,
        path: string,
        options: {
            params?: Record<string, string | number | undefined>;
            body?: unknown;
            rawResponse: true;
        }
    ): Promise<{ data: ArrayBuffer; headers: Headers }>;
    private async request<T>(
        method: string,
        path: string,
        options: {
            params?: Record<string, string | number | undefined>;
            body?: unknown;
            rawResponse?: boolean;
        } = {}
    ): Promise<T | { data: ArrayBuffer; headers: Headers }> {
        let url = `${this.baseUrl}${path}`;

        if (options.params) {
            const filtered = Object.entries(options.params).filter(
                ([, v]) => v !== undefined
            );
            if (filtered.length > 0) {
                const qs = new URLSearchParams(
                    filtered.map(([k, v]) => [k, String(v)])
                );
                url += `?${qs}`;
            }
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal,
            });

            if (!response.ok) {
                let message: string;
                try {
                    const errorBody = await response.json();
                    message = errorBody.error || response.statusText;
                } catch {
                    message = response.statusText;
                }
                throw new VanishError(message, response.status);
            }

            if (options.rawResponse) {
                return { data: await response.arrayBuffer(), headers: response.headers };
            }

            return (await response.json()) as T;
        } catch (error) {
            if (error instanceof VanishError) throw error;
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new VanishError("Request timeout");
            }
            throw new VanishError(`Request failed: ${error}`);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /** Get list of available email domains */
    async getDomains(): Promise<string[]> {
        const resp = await this.request<{ domains: string[] }>("GET", "/domains", {});
        return resp.domains;
    }

    /** Generate a unique temporary email address */
    async generateEmail(options: GenerateEmailOptions = {}): Promise<string> {
        const resp = await this.request<{ email: string }>("POST", "/mailbox", {
            body: Object.keys(options).length > 0 ? options : undefined,
        });
        return resp.email;
    }

    /** List emails for a mailbox address */
    async listEmails(
        address: string,
        options: ListEmailsOptions = {}
    ): Promise<PaginatedEmailList> {
        const resp = await this.request<{
            data: Array<{
                id: string;
                from: string;
                subject: string;
                textPreview: string;
                receivedAt: string;
                hasAttachments: boolean;
            }>;
            nextCursor: string | null;
            total: number;
        }>("GET", `/mailbox/${encodeURIComponent(address)}`, {
            params: {
                limit: options.limit,
                cursor: options.cursor,
            },
        });

        return {
            data: resp.data.map((e) => ({
                ...e,
                receivedAt: new Date(e.receivedAt),
            })),
            nextCursor: resp.nextCursor,
            total: resp.total,
        };
    }

    /** Get full details of a specific email */
    async getEmail(emailId: string): Promise<EmailDetail> {
        const resp = await this.request<{
            id: string;
            from: string;
            to: string[];
            subject: string;
            html: string;
            text: string;
            receivedAt: string;
            hasAttachments: boolean;
            attachments: AttachmentMeta[];
        }>("GET", `/email/${emailId}`, {});

        return {
            ...resp,
            receivedAt: new Date(resp.receivedAt),
        };
    }

    /** Download an attachment and return its content with headers */
    async getAttachment(
        emailId: string,
        attachmentId: string
    ): Promise<{ data: ArrayBuffer; headers: Headers }> {
        return this.request("GET", `/email/${emailId}/attachments/${attachmentId}`, {
            rawResponse: true,
        });
    }

    /** Delete a specific email */
    async deleteEmail(emailId: string): Promise<boolean> {
        const resp = await this.request<{ success: boolean }>(
            "DELETE",
            `/email/${emailId}`,
            {}
        );
        return resp.success;
    }

    /** Delete all emails in a mailbox */
    async deleteMailbox(address: string): Promise<number> {
        const resp = await this.request<{ deleted: number }>(
            "DELETE",
            `/mailbox/${encodeURIComponent(address)}`,
            {}
        );
        return resp.deleted;
    }

    /**
     * Poll for new emails until one arrives or timeout.
     * @param address Email address to poll
     * @param timeout Maximum time to wait in milliseconds
     * @param interval Check interval in milliseconds
     * @param initialCount Initial email count to compare against
     */
    async pollForEmails(
        address: string,
        timeout = 60000,
        interval = 5000,
        initialCount = 0
    ): Promise<EmailSummary | null> {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const result = await this.listEmails(address, { limit: 1 });
            if (result.total > initialCount && result.data.length > 0) {
                return result.data[0];
            }
            await new Promise((resolve) => setTimeout(resolve, interval));
        }

        return null;
    }
}

/** Convenience function for quick client creation */
export function createClient(
    baseUrl: string,
    options?: VanishClientOptions
): VanishClient {
    return new VanishClient(baseUrl, options);
}

export default VanishClient;
