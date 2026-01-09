import { ContentJob, JobStep, JobState } from './types';

/**
 * Real-time Progress Manager
 * Orchestrates job state, tracks progress, and emits SSE events
 */
export class ProgressManager {
  private jobs = new Map<string, ContentJob>();
  private eventListeners = new Map<string, Set<(job: ContentJob) => void>>();
  private progressIntervals = new Map<string, NodeJS.Timer>();

  createJob(
    jobId: string,
    siteId: string,
    mode: 'generate' | 'optimize',
    url?: string
  ): ContentJob {
    const job: ContentJob = {
      jobId,
      siteId,
      url,
      mode,
      state: 'pending',
      progress: 0,
      currentStep: 'Initializing',
      steps: this.initializeSteps(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.emitProgress(jobId, job);
    return job;
  }

  private initializeSteps(): JobStep[] {
    return [
      {
        id: 'briefing',
        name: 'SERP Analysis',
        description: 'Analyzing search intent, competitors, and entities',
        status: 'pending',
        duration: 0,
        message: 'Awaiting start',
        progress: 0,
      },
      {
        id: 'outlining',
        name: 'Outline Generation',
        description: 'Creating H2/H3 structure with section objectives',
        status: 'pending',
        duration: 0,
        message: 'Awaiting start',
        progress: 0,
      },
      {
        id: 'drafting',
        name: 'Content Drafting',
        description: 'Writing sections with tactical, high-quality content',
        status: 'pending',
        duration: 0,
        message: 'Awaiting start',
        progress: 0,
      },
      {
        id: 'enriching',
        name: 'Content Enrichment',
        description: 'Adding examples, checklists, callouts, and visual blocks',
        status: 'pending',
        duration: 0,
        message: 'Awaiting start',
        progress: 0,
      },
      {
        id: 'quality_check',
        name: 'Quality Assurance',
        description: 'Scoring content: readability, SEO, completeness, uniqueness',
        status: 'pending',
        duration: 0,
        message: 'Awaiting start',
        progress: 0,
      },
      {
        id: 'rendering',
        name: 'HTML Rendering',
        description: 'Rendering components to enterprise-grade HTML',
        status: 'pending',
        duration: 0,
        message: 'Awaiting start',
        progress: 0,
      },
    ];
  }

  async updateProgress(
    jobId: string,
    state: JobState,
    stepId: string,
    progress: number,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.state = state;
    job.progress = progress;
    job.currentStep = stepId;
    job.updatedAt = new Date();

    const step = job.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = progress === 100 ? 'complete' : 'running';
      step.message = message;
      step.progress = progress;
      if (data) step.data = data;
      if (!step.startTime) step.startTime = new Date();
      step.duration =
        new Date().getTime() - (step.startTime?.getTime() || 0);
    }

    this.emitProgress(jobId, job);
  }

  completeStep(
    jobId: string,
    stepId: string,
    message: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const step = job.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = 'complete';
      step.message = message;
      step.duration =
        new Date().getTime() - (step.startTime?.getTime() || 0);
    }

    this.emitProgress(jobId, job);
  }

  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'failed';
    job.error = error;
    job.completedAt = new Date();
    this.emitProgress(jobId, job);
  }

  completeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'complete';
    job.progress = 100;
    job.completedAt = new Date();
    this.emitProgress(jobId, job);
  }

  getJob(jobId: string): ContentJob | undefined {
    return this.jobs.get(jobId);
  }

  subscribe(
    jobId: string,
    callback: (job: ContentJob) => void
  ): () => void {
    if (!this.eventListeners.has(jobId)) {
      this.eventListeners.set(jobId, new Set());
    }
    this.eventListeners.get(jobId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(jobId)?.delete(callback);
    };
  }

  private emitProgress(jobId: string, job: ContentJob): void {
    const listeners = this.eventListeners.get(jobId);
    if (listeners) {
      listeners.forEach((callback) => callback(job));
    }
  }
}

// Global instance
export const progressManager = new ProgressManager();
