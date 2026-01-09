import { NextRequest, NextResponse } from 'next/server';
import { progressManager } from '@/lib/pipeline/progress-manager';

/**
 * ENTERPRISE-GRADE STATUS ENDPOINT
 * GET /api/optimize/status?jobId=xxx
 * Retrieves real-time progress of an optimization job
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter required' },
        { status: 400 }
      );
    }

    const job = progressManager.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', jobId },
        { status: 404 }
      );
    }

    // Return complete job status
    return NextResponse.json({
      success: true,
      jobId,
      state: job.state,
      progress: job.progress,
      currentStep: job.currentStep,
      steps: job.steps,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      error: job.error,
      metadata: job.metadata,
    });
  } catch (error) {
    console.error('[/api/optimize/status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
