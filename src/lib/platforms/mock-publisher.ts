import {
  SocialPublisher,
  PlatformPost,
  ValidationResult,
  PublishResult,
  DraftUploadResult,
  PublishStatusResult,
} from '@/lib/platforms/types'

/**
 * Mock publisher for development and testing.
 * Simulates successful/failed publishing without calling any real API.
 */
export class MockPublisher implements SocialPublisher {
  private shouldFail: boolean

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail
  }

  async validate(post: PlatformPost): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!post.mediaUrl) {
      errors.push('No media URL provided')
    }
    if (!post.caption && post.platform === 'INSTAGRAM') {
      warnings.push('Caption is empty — consider adding one for engagement')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  async publish(post: PlatformPost): Promise<PublishResult> {
    // Simulate API latency
    await new Promise((r) => setTimeout(r, 800))

    if (this.shouldFail) {
      return {
        success: false,
        errorCode: 'mock_error',
        errorMessage: 'Mock publisher: simulated failure for testing',
        status: 'FAILED',
      }
    }

    const mockId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const platform = post.platform.toLowerCase()
    const mockUrl = `https://${platform}.com/p/${mockId}`

    console.log(`[MockPublisher] Simulated successful publish: ${mockUrl}`)

    return {
      success: true,
      platformMediaId: mockId,
      platformPostUrl: mockUrl,
      status: 'POSTED',
    }
  }

  async uploadDraft(post: PlatformPost): Promise<DraftUploadResult> {
    void post
    await new Promise((r) => setTimeout(r, 500))

    const mockId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log(`[MockPublisher] Simulated draft upload: ${mockId}`)

    return {
      success: true,
      externalId: mockId,
    }
  }

  async getStatus(externalPublishId: string): Promise<PublishStatusResult> {
    return {
      status: 'posted',
      platformPostUrl: `https://tiktok.com/@user/video/${externalPublishId}`,
    }
  }
}
