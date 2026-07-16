import { AccidentEventType, UserAccidentEvent } from '@prisma/client';

export interface CreateAccidentEventInput {
  userId: string;
  eventType: AccidentEventType;
  detectedAt: Date;
}

export interface AccidentMonitorResult {
  fallDetectedCount: number;
  noMovementCount: number;
}

export type ProcessedAccidentEvent = Pick<
  UserAccidentEvent,
  'userId' | 'eventType' | 'detectedAt'
>;
