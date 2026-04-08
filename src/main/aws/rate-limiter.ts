// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DEFAULT_SERVICE_RATE_LIMITS,
  type RateLimiterConfig,
  type ServiceRateLimits,
} from '../../shared/types';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  requestsPerSecond: number;
  burstLimit: number;
}

interface BackoffState {
  failures: number;
  nextRetryTime: number;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private backoffStates: Map<string, BackoffState> = new Map();
  private rateLimits: ServiceRateLimits;

  // Backoff configuration
  private readonly baseDelayMs = 1000;
  private readonly maxDelayMs = 60000;
  private readonly maxRetries = 5;
  private readonly jitterFactor = 0.2;

  constructor(customLimits?: Partial<ServiceRateLimits>) {
    this.rateLimits = { ...DEFAULT_SERVICE_RATE_LIMITS, ...(customLimits || {}) } as ServiceRateLimits;
  }

  private getBucketKey(service: string, region: string): string {
    return `${service}:${region}`;
  }

  private getOrCreateBucket(service: string, region: string): TokenBucket {
    const key = this.getBucketKey(service, region);
    let bucket = this.buckets.get(key);

    if (!bucket) {
      const config = this.rateLimits[service] || {
        requestsPerSecond: 10,
        burstLimit: 50,
      };

      bucket = {
        tokens: config.burstLimit,
        lastRefill: Date.now(),
        requestsPerSecond: config.requestsPerSecond,
        burstLimit: config.burstLimit,
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  private refillTokens(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.requestsPerSecond;

    bucket.tokens = Math.min(bucket.burstLimit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private addJitter(delay: number): number {
    const jitter = delay * this.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  private calculateBackoffDelay(failures: number): number {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, failures - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);
    return this.addJitter(cappedDelay);
  }

  async acquire(service: string, region: string): Promise<void> {
    const key = this.getBucketKey(service, region);

    // Check backoff state
    const backoffState = this.backoffStates.get(key);
    if (backoffState && Date.now() < backoffState.nextRetryTime) {
      const waitTime = backoffState.nextRetryTime - Date.now();
      await this.sleep(waitTime);
    }

    // Acquire token
    const bucket = this.getOrCreateBucket(service, region);
    this.refillTokens(bucket);

    while (bucket.tokens < 1) {
      // Wait for tokens to refill
      const waitTime = (1 / bucket.requestsPerSecond) * 1000;
      await this.sleep(this.addJitter(waitTime));
      this.refillTokens(bucket);
    }

    bucket.tokens -= 1;
  }

  recordSuccess(service: string, region: string): void {
    const key = this.getBucketKey(service, region);
    this.backoffStates.delete(key);
  }

  recordFailure(service: string, region: string, isThrottling: boolean): boolean {
    const key = this.getBucketKey(service, region);
    let state = this.backoffStates.get(key);

    if (!state) {
      state = { failures: 0, nextRetryTime: 0 };
      this.backoffStates.set(key, state);
    }

    state.failures += 1;

    // If it's a throttling error, apply backoff
    if (isThrottling) {
      const delay = this.calculateBackoffDelay(state.failures);
      state.nextRetryTime = Date.now() + delay;
      console.log(
        `Rate limited for ${key}. Backing off for ${delay}ms (attempt ${state.failures}/${this.maxRetries})`
      );
    }

    // Return whether we should retry
    return state.failures < this.maxRetries;
  }

  getRetryCount(service: string, region: string): number {
    const key = this.getBucketKey(service, region);
    return this.backoffStates.get(key)?.failures || 0;
  }

  reset(service: string, region: string): void {
    const key = this.getBucketKey(service, region);
    this.buckets.delete(key);
    this.backoffStates.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
    this.backoffStates.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Helper to check if an error is a throttling error
  static isThrottlingError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorName = (error as { name?: string }).name;
      const errorCode = (error as { code?: string }).code;
      const message = error.message.toLowerCase();

      return (
        errorName === 'ThrottlingException' ||
        errorName === 'Throttling' ||
        errorCode === 'Throttling' ||
        errorCode === 'ThrottlingException' ||
        errorCode === 'RequestLimitExceeded' ||
        errorCode === 'TooManyRequestsException' ||
        errorCode === 'ProvisionedThroughputExceededException' ||
        message.includes('rate exceeded') ||
        message.includes('throttl') ||
        message.includes('too many requests')
      );
    }
    return false;
  }
}

// Singleton instance
let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

// Decorator function for rate-limited API calls
export async function withRateLimit<T>(
  service: string,
  region: string,
  operation: () => Promise<T>
): Promise<T> {
  const limiter = getRateLimiter();

  await limiter.acquire(service, region);

  try {
    const result = await operation();
    limiter.recordSuccess(service, region);
    return result;
  } catch (error) {
    const isThrottling = RateLimiter.isThrottlingError(error);
    const shouldRetry = limiter.recordFailure(service, region, isThrottling);

    if (isThrottling && shouldRetry) {
      // Retry the operation
      return withRateLimit(service, region, operation);
    }

    throw error;
  }
}
